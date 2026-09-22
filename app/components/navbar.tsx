"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { User } from "@supabase/supabase-js"

export default function Navbar() {
    const [user, setUser] = useState<User | null>(null);
    useEffect(() => {
        const getUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            setUser(user);
        };

        getUser();
    }, []);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Erreur lors de la déconnexion :", error);
            return;
        }

        setUser(null);
    };

    return (
        <nav className="border-b">
            <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
                <Link href="/" className="text-xl font-bold">
                    Book Collector
                </Link>

                <div className="flex gap-4">
                    <Link href="/">Accueil</Link>

                    {user ? (
                        <>
                            <Link href="/library">Ma pile à lire</Link>

                            <button onClick={handleLogout}>
                                Déconnexion
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login">Connexion</Link>
                            <Link href="/register">Inscription</Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}