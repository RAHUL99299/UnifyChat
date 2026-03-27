# UnifyChat

## Project info

UnifyChat - Connect, chat, and share seamlessly.

## How can I edit this code?

**Use your preferred IDE**

This project can be edited locally. The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (auth, realtime, storage)

## How can I deploy this project?

Build the project and deploy the output to any static host (Vercel, Netlify, etc.):

```sh
npm run build
```

Then upload the contents of the `dist` folder to your hosting provider.

## Web Push Setup (Mobile Top-Bar Notifications)

To enable push notifications that work when the app is in the background or closed:

1. Generate VAPID keys (one-time):

```sh
npx web-push generate-vapid-keys
```

2. Add the public key to your app environment:

```sh
VITE_WEB_PUSH_PUBLIC_KEY=<your_public_key>
```

3. Deploy the Supabase edge function:

```sh
supabase functions deploy send_push_message
```

4. Set these Supabase function secrets:

```sh
SUPABASE_URL=<project_url>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_ANON_KEY=<anon_key>
WEB_PUSH_VAPID_PUBLIC_KEY=<your_public_key>
WEB_PUSH_VAPID_PRIVATE_KEY=<your_private_key>
WEB_PUSH_SUBJECT=mailto:you@example.com
```

5. Run DB migrations so `push_subscriptions` exists:

```sh
supabase db push
```

Notes:
- Push notifications require HTTPS in production.
- iOS Safari web push requires users to add the app to Home Screen.
