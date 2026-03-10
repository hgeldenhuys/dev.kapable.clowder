import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { useState, useEffect } from "react";

import type { Route } from "./+types/root";
import { Toaster } from "sonner";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/logo.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Outfit:wght@400;500;600;700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Clowder — AI App Builder by Kapable</title>
        <meta name="description" content="Describe your app idea. Our AI expert committee designs, builds, and deploys it — from concept to production in minutes." />
        <meta property="og:title" content="Clowder — AI App Builder" />
        <meta property="og:description" content="A committee of AI experts builds your app from a description. Powered by Kapable." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://clowder.kapable.run" />
        <meta property="og:image" content="https://clowder.kapable.run/logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Clowder — AI App Builder" />
        <meta name="twitter:description" content="Describe your app. AI experts build it." />
        <meta name="twitter:image" content="https://clowder.kapable.run/logo.png" />
        <meta name="theme-color" content="#FAF9F6" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ClientOnlyToaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function ClientOnlyToaster() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <Toaster position="top-right" richColors />;
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-4">{message}</h1>
        <p className="text-muted-foreground mb-6">{details}</p>
        {stack && (
          <pre className="text-left text-sm bg-secondary p-4 rounded overflow-auto">
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </main>
  );
}
