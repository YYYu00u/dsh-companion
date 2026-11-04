// EarsCapture: record system audio or the microphone for a few seconds.
//
// ScreenCaptureKit is used for system audio (macOS 13+); the first run asks for
// "Screen & System Audio Recording" permission. This is an independent
// implementation; the approach was informed by insidegui/AudioCap (BSD-2) and
// Apple's ScreenCaptureKit documentation.
#import <Foundation/Foundation.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreMedia/CoreMedia.h>

@interface EarsRecorder : NSObject <SCStreamOutput, SCStreamDelegate>
@property (nonatomic, strong) SCStream *stream;
@property (nonatomic, strong) AVAudioFile *file;
@property (nonatomic, strong) NSURL *out;
@property (nonatomic, assign) NSInteger seconds;
@property (nonatomic, assign) BOOL done;
- (void)startWithCompletion:(void (^)(NSError *error))completion;
@end

@implementation EarsRecorder

- (void)startWithCompletion:(void (^)(NSError *))completion {
  [SCShareableContent getShareableContentExcludingDesktopWindows:NO onScreenWindowsOnly:YES completionHandler:^(SCShareableContent *content, NSError *error) {
    if (error) { completion(error); return; }
    SCDisplay *display = content.displays.firstObject;
    if (!display) {
      completion([NSError errorWithDomain:@"ears" code:1 userInfo:@{NSLocalizedDescriptionKey: @"no display"}]);
      return;
    }
    SCContentFilter *filter = [[SCContentFilter alloc] initWithDisplay:display excludingApplications:@[] exceptingWindows:@[]];
    SCStreamConfiguration *config = [[SCStreamConfiguration alloc] init];
    config.capturesAudio = YES;
    config.excludesCurrentProcessAudio = YES;
    config.sampleRate = 16000;
    config.channelCount = 1;
    self.stream = [[SCStream alloc] initWithFilter:filter configuration:config delegate:self];
    NSError *addError = nil;
    dispatch_queue_t queue = dispatch_queue_create("ears.audio", DISPATCH_QUEUE_SERIAL);
    if (![self.stream addStreamOutput:self type:SCStreamOutputTypeAudio sampleHandlerQueue:queue error:&addError]) {
      completion(addError);
      return;
    }
    [self.stream startCaptureWithCompletionHandler:^(NSError *startError) {
      if (startError) { completion(startError); return; }
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(self.seconds * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        self.done = YES;
        [self.stream stopCaptureWithCompletionHandler:^(NSError *stopError) {
          completion(stopError);
          [NSThread exit];
        }];
      });
    }];
  }];
}

- (void)stream:(SCStream *)stream didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer ofType:(SCStreamOutputType)type {
  if (type != SCStreamOutputTypeAudio || self.done) return;
  CMFormatDescriptionRef desc = CMSampleBufferGetFormatDescription(sampleBuffer);
  if (!desc) return;
  const AudioStreamBasicDescription *asbd = CMAudioFormatDescriptionGetStreamBasicDescription(desc);
  if (!asbd) return;
  AVAudioFormat *format = [[AVAudioFormat alloc] initWithStreamDescription:asbd];
  if (!format) return;
  AVAudioFrameCount frames = (AVAudioFrameCount)CMSampleBufferGetNumSamples(sampleBuffer);
  if (frames == 0) return;
  AVAudioPCMBuffer *buffer = [[AVAudioPCMBuffer alloc] initWithPCMFormat:format frameCapacity:frames];
  if (!buffer) return;
  buffer.frameLength = frames;
  OSStatus status = CMSampleBufferCopyPCMDataIntoAudioBufferList(sampleBuffer, 0, (int32_t)frames, buffer.mutableAudioBufferList);
  if (status != noErr) return;
  NSError *writeError = nil;
  if (!self.file) {
    self.file = [[AVAudioFile alloc] initForWriting:self.out settings:format.settings error:&writeError];
    if (!self.file) {
      fprintf(stderr, "ears-capture: cannot create wav: %s\n", writeError.localizedDescription.UTF8String);
      return;
    }
  }
  if (![self.file writeFromBuffer:buffer error:&writeError]) {
    fprintf(stderr, "ears-capture: write failed: %s\n", writeError.localizedDescription.UTF8String);
  }
}

- (void)stream:(SCStream *)stream didStopWithError:(NSError *)error {
  if (error) fprintf(stderr, "ears-capture: stream stopped: %s\n", error.localizedDescription.UTF8String);
}

@end

static NSInteger argInt(NSArray<NSString *> *args, NSString *name, NSInteger fallback) {
  NSUInteger i = [args indexOfObject:name];
  if (i == NSNotFound || i + 1 >= args.count) return fallback;
  return [args[i + 1] integerValue];
}
static NSString *argString(NSArray<NSString *> *args, NSString *name, NSString *fallback) {
  NSUInteger i = [args indexOfObject:name];
  if (i == NSNotFound || i + 1 >= args.count) return fallback;
  return args[i + 1];
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    NSArray<NSString *> *args = [[NSProcessInfo processInfo] arguments];
    NSString *source = argString(args, @"--source", @"system");
    NSInteger seconds = MAX(1, MIN(30, argInt(args, @"--seconds", 15)));
    NSString *outPath = argString(args, @"--out", @"out.wav");
    NSURL *out = [NSURL fileURLWithPath:outPath];

    if ([source isEqualToString:@"mic"]) {
      AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
      if (status == AVAuthorizationStatusDenied || status == AVAuthorizationStatusRestricted) {
        fprintf(stderr, "ears-capture: microphone permission denied (System Settings > Privacy & Security > Microphone)\n");
        return 2;
      }
      if (status == AVAuthorizationStatusNotDetermined) {
        dispatch_semaphore_t sem = dispatch_semaphore_create(0);
        [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL granted) {
          if (!granted) fprintf(stderr, "ears-capture: microphone permission denied\n");
          dispatch_semaphore_signal(sem);
        }];
        dispatch_semaphore_wait(sem, dispatch_time(DISPATCH_TIME_NOW, 30 * NSEC_PER_SEC));
      }
      AVAudioEngine *engine = [[AVAudioEngine alloc] init];
      AVAudioInputNode *input = engine.inputNode;
      AVAudioFormat *format = [input inputFormatForBus:0];
      NSError *err = nil;
      AVAudioFile *file = [[AVAudioFile alloc] initForWriting:out settings:format.settings error:&err];
      if (!file) { fprintf(stderr, "ears-capture: %s\n", err.localizedDescription.UTF8String); return 2; }
      [input installTapOnBus:0 bufferSize:4096 format:format block:^(AVAudioPCMBuffer *buffer, AVAudioTime *when) {
        NSError *writeErr = nil;
        if (![file writeFromBuffer:buffer error:&writeErr]) fprintf(stderr, "ears-capture: write failed\n");
      }];
      [engine prepare];
      if (![engine startAndReturnError:&err]) { fprintf(stderr, "ears-capture: %s\n", err.localizedDescription.UTF8String); return 2; }
      [NSThread sleepForTimeInterval:(NSTimeInterval)seconds];
      [engine stop];
      [input removeTapOnBus:0];
      return 0;
    }

    if (![source isEqualToString:@"system"]) {
      fprintf(stderr, "ears-capture: --source must be system or mic\n");
      return 2;
    }

    EarsRecorder *recorder = [[EarsRecorder alloc] init];
    recorder.out = out;
    recorder.seconds = seconds;
    [recorder startWithCompletion:^(NSError *error) {
      if (error) {
        fprintf(stderr, "ears-capture: %s\n", error.localizedDescription.UTF8String);
        exit(2);
      }
      exit(0);
    }];
    [[NSRunLoop currentRunLoop] run];
  }
  return 0;
}
