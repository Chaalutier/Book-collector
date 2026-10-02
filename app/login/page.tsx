"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    const router = useRouter();

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setPending(true);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        setPending(false);

        if (error) {
            console.error(error);
            setError("Email ou mot de passe incorrect.");
            return;
        }

        // refresh() relance les Server Components (navbar comprise)
        router.push("/library");
        router.refresh();
    };

    return (
        <main className="mx-auto w-full max-w-md px-4 py-12">
            <h1 className="text-2xl font-bold">Me connecter</h1>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium">
                        Email
                    </label>

                    <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="field mt-1"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium">
                        Mot de passe
                    </label>

                    <input
                        id="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="field mt-1"
                    />
                </div>

                <button type="submit" disabled={pending} className="btn-primary w-full">
                    {pending ? "Connexion…" : "Me connecter"}
                </button>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <p className="text-sm text-muted">
                    Pas encore de compte ?{" "}
                    <Link href="/register" className="underline">
                        Inscription
                    </Link>
                </p>
            </form>
        </main>
    );
}
