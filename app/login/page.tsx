"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/app/components/PasswordInput";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    const router = useRouter();

    // Sur la page de connexion, on efface la copie hors ligne de la wishlist (appareil partagé, changement de compte)
    useEffect(() => {
        if ("caches" in window) caches.delete("bouck-pages-v1").catch(() => {});
        // Retour d'un lien de confirmation qui n'a pas fonctionné
        if (new URLSearchParams(window.location.search).get("confirm") === "error") {
            setError("Le lien de confirmation a expiré ou a déjà été utilisé. Si ton adresse est confirmée, connecte-toi simplement.");
        }
    }, []);

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
                    <PasswordInput
                        id="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={setPassword}
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
