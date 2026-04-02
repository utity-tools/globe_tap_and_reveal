# 🌍 Globy: Tap & Reveal

![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-black?style=for-the-badge&logo=vercel)
![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-green?style=for-the-badge&logo=supabase)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=for-the-badge&logo=typescript)

**Globy** es una aplicación interactiva de mapeo de viajes que permite a los usuarios documentar sus aventuras por el mundo. No es solo un mapa; es un motor geográfico capaz de identificar biomas, países y registrar memorias fotográficas en tiempo real.

![image](https://github.com/user-attachments/assets/9f6cd222-26bd-41b1-b796-abc8d987510a)

---

## 🚀 Características Principales

* **📍 Drop & Pin:** Haz clic en cualquier parte del globo para colocar un marcador.
* **🧠 Motor de Biomas:** Identificación dinámica de terrenos (Desierto, Selva, Tundra, etc.) basada en coordenadas.
* **📸 Galería de Recuerdos:** Sube fotos directamente a cada pin, almacenadas de forma segura en la nube.
* **🔐 Autenticación Social:** Inicio de sesión seguro integrado con **Google OAuth 2.0**.
* **🌍 Estadísticas Globales:** Contador de países visitados y progreso de exploración mundial.

---

## 🛠️ Stack Tecnológico

### Frontend
* **React + Vite:** Para una interfaz ultra rápida y reactiva.
* **Tailwind CSS:** Diseño moderno, oscuro y *mobile-first*.
* **Lucide React:** Iconografía minimalista.

### Backend & Infraestructura (BaaS)
* **Supabase (PostgreSQL):** Gestión de base de datos relacional.
* **Row-Level Security (RLS):** Políticas de seguridad avanzadas donde cada usuario solo puede acceder a sus propios datos.
* **Supabase Storage:** Almacenamiento de imágenes organizado por carpetas de usuario (`auth.uid()`).

### Deployment
* **Vercel:** Pipeline de CI/CD configurado para despliegues automáticos desde la rama `main`.

---

## 🔐 Detalles Técnicos de Seguridad

El proyecto implementa un modelo de seguridad **Zero Trust** en la base de datos mediante SQL:

```sql
-- Ejemplo de política RLS implementada para los Pines
CREATE POLICY "Users can only see their own pins" 
ON public.pins FOR SELECT 
USING (auth.uid() = user_id);

-- Ejemplo de política para Storage (Imágenes)
CREATE POLICY "Individual User Storage" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);


🗺️ Hoja de Ruta (Roadmap)
[x] Integración de Google Auth.

[x] Subida de imágenes a Supabase Storage.

[x] Despliegue en producción (Vercel).

[ ] Compartir mapas públicos mediante URL única.

[ ] Modo offline con PWA.

[ ] Modo amigos pines compartidos

[ ] Sonidos y efectos

Desarrollado con ❤️ por Utity Tools – ¡Nos vemos en el mapa! 🕊️