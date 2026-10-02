"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    const router = useRouter();

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setMessage("");
        setPending(true);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        setPending(false);

        if (error) {
            console.error(error);
            setError(error.message);
            return;
        }

        // Sans confirmation par email, la session est ouverte tout de suite
        if (data.session) {
            router.push("/profile");
            router.refresh();
            return;
        }

        setMessage("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse.");
    };

    return (
        <main className="mx-auto w-full max-w-md px-4 py-12">
            <h1 className="text-2xl font-bold">Créer un compte</h1>

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
                        minLength={6}
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="field mt-1"
                    />
                </div>

                <button type="submit" disabled={pending} className="btn-primary w-full">
                    {pending ? "Création…" : "Créer mon compte"}
                </button>

                {message && <p className="text-sm text-accent-strong">{message}</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}

                <p className="text-sm text-muted">
                    Déjà inscrit ?{" "}
                    <Link href="/login" className="underline">
                        Connexion
                    </Link>
                </p>
            </form>
        </main>
    );
}
