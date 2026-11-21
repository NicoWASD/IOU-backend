# IOU · Backend

API REST de **IOU** ("I owe you"), una app web para registrar gastos compartidos en grupo, ver quién le debe a quién y saldar deudas con la mínima cantidad de transferencias.

> 🚧 En desarrollo. Hito actual: **H0 · Fundaciones**.

## Links

| | |
|---|---|
| Frontend | _pendiente_ · repo: [IOU-client](https://github.com/NicoWASD/IOU-client) |
| API en producción | _pendiente_ |

## Documentación

- [Especificación](docs/spec.md): modelo de datos, reglas de negocio, casos borde, API y arquitectura.
- [Historias de usuario e hitos](docs/historias-usuario.md)
- Informe de QA: _pendiente_ (`docs/qa.md`)

## Stack

Node.js 22 · Express · TypeScript · Prisma · PostgreSQL (Neon) · Zod · JWT · Vitest + Supertest · Docker

## Arquitectura

`routes → controllers → services (reglas de negocio) → repositories (Prisma) → PostgreSQL`

## Cómo ejecutarlo

_Se completa en el H0._
