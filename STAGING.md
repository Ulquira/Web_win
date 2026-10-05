# Ambiente de Staging / Preview - Rediseño Frontend v2

Este ambiente está configurado en la rama `feature/nuevo-front` para desarrollar y validar los nuevos mockups de Figma de forma aislada sin afectar la versión en producción (`go.win.pe`).

- **Base de datos:** Azure MySQL (Producción / QA)
- **API:** Azure App Service (`webwin-api-service`)
- **Staging URL:** Generada automáticamente por Azure Static Web Apps en el Pull Request.
