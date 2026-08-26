# Mi Planificador Personal

PWA en Angular para organizar trabajo, universidad, estudio y ejercicio sin saturar los días pesados.

## Cómo correrla

```bash
npm start
```

Abre `http://localhost:4200/`. En el celular, con un build de producción, se puede instalar en la pantalla de inicio.

```bash
npm run build
```

## Qué incluye esta versión

- Horario laboral L/M/J 08:00–18:00 y M/V 09:00–19:00
- Clases presenciales y el curso virtual de Análisis y Diseño
- Ejercicio fijo: martes y viernes 07:00, sábado 10:00, domingo caminata
- Tareas con prioridad, fecha límite y registro de horas
- Motor que detecta el jueves sobrecargado y sugiere estudio solo en huecos sanos
- Cumplimiento de ejercicio y motivos si una sesión no se hizo
- Datos en LocalStorage (sin backend)

## Etapas

1. **V1** Planificador básico — lista
2. **V2** PWA instalable y offline — lista
3. **V3** Inteligencia de planificación — primera versión
4. **V4** Backend .NET 8 + PostgreSQL
5. **V5** Estadísticas históricas más profundas
