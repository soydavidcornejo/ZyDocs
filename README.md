# ZyDocs

ZyDocs es una plataforma moderna de gestión de documentación que permite a equipos y organizaciones crear, organizar y colaborar en documentos estructurados jerárquicamente.

## Características Principales

- 📝 **Editor WYSIWYG**: Editor enriquecido con soporte para Markdown
- 🌲 **Estructura Jerárquica**: Organiza documentos en una estructura de árbol navegable
- 👥 **Gestión de Organizaciones**: Crea y administra equipos con diferentes usuarios
- 🔐 **Autenticación**: Login seguro con Google
- 🌓 **Tema Claro/Oscuro**: Cambia entre temas visuales según tu preferencia
- 🔔 **Notificaciones**: Sistema de alertas para cambios y actualizaciones

## Tecnologías

- Next.js 15
- Firebase (Autenticación y Firestore)
- TypeScript
- Tailwind CSS
- Radix UI
- GenKit AI Integration

## Requisitos Previos

- Node.js 18.0+
- npm o yarn
- Cuenta en Firebase
- Opcionalmente: cuenta en Vercel para despliegue

## Instalación y Configuración

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/zydocs.git
   cd zydocs
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   # o
   yarn install
   ```

3. **Configurar variables de entorno**
   Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyCMzjrR9XCJtHLEy2D3elm2hNgyXHKYt7Y"
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="zydocs.firebaseapp.com"
   NEXT_PUBLIC_FIREBASE_PROJECT_ID="zydocs"
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="zydocs.firebasestorage.app"
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="983023476291"
   NEXT_PUBLIC_FIREBASE_APP_ID="1:983023476291:web:ff4e37bb5553c663dd7ef6"
   ```

4. **Iniciar entorno de desarrollo**
   ```bash
   npm run dev
   # o
   yarn dev
   ```
   La aplicación estará disponible en http://localhost:9002

## Estructura del Proyecto

- `/src/app` - Páginas y rutas de Next.js
- `/src/components` - Componentes reutilizables
- `/src/lib` - Configuraciones y utilidades
- `/src/types` - Definiciones de tipos
- `/src/contexts` - Contextos de React
- `/src/hooks` - Hooks personalizados
- `/src/services` - Servicios externos

## Despliegue

ZyDocs está optimizado para despliegue en Vercel:

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno en el panel de Vercel
3. Despliega la aplicación

También puedes desplegar en cualquier plataforma que soporte Next.js.

## Contribución

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/amazing-feature`)
3. Haz commit de tus cambios (`git commit -m 'Add some amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request
