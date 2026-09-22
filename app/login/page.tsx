"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");

    const router = useRouter();

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error(error);
            return;
        }

        setMessage("Connexion réussie");

        router.push("/library");
        router.refresh();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        console.log("Utilisateur récupéré :", user);
    };

    return (
        <main className="mx-auto max-w-md p-8">
            <h1 className="text-2xl font-bold">Me connecter</h1>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium">
                        Email
                    </label>

                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="mt-1 w-full rounded-lg border p-2"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium">
                        Mot de passe
                    </label>

                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="mt-1 w-full rounded-lg border p-2"
                    />
                </div>

                <button
                    type="submit"
                    className="w-full rounded-lg bg-black px-4 py-2 text-white"
                >
                    Me connecter
                </button>
                {message && (
                    <p className="mt-4 text-sm">
                        {message}
                    </p>
                )}
            </form>
        </main>
    );
}