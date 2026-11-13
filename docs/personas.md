# Persona slots

The public web package already supports more than one name without forking the code.

## Roster

```yaml
- id: companion-web
  name: '@dsh-companion/web'
  config:
    home: ~/.dsh-companion
    # optional: inline people
    people:
      - id: xiaoya
        name: 小雅
        home: ~/.dsh-companion/personas/xiaoya
        preset: persona-xiaoya
        path: /p/xiaoya
    # or a roster file: { "people": [ ... ] }
    # roster: ~/.dsh-companion/personas/roster.json
    # shared base profile for every slot
    sharedProfile: ~/.dsh-companion/personas/shared/profile.json
```

Each slot gets:

```text
/p/<id>/          its own chat, history, memory, diary, signature
```

The main home stays at `/companion/`.

## Shared vs personal

| Shared | Per slot |
|---|---|
| appearance / images served by the web package | `profile.json` signature and signature history |
| `sharedProfile`: birthday, age, city, height | chat session |
| default voice (if configured) | memory, diary, moments, lessons, wishes |
| | `background` switch |

`GET /api/profile` merges the shared base with the slot's own `profile.json`; a non-empty personal field overrides, except birthday/age/city/height, which stay shared.

This is the same contract the private `the reference setup` setup uses, without copying its files.
