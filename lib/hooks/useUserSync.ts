"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

export function useUserSync() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      // Sync user data with our database
      const syncUser = async () => {
        try {
          const response = await fetch("/api/users/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: user.primaryEmailAddress?.emailAddress,
            }),
          });

          if (!response.ok) {
            console.error("Failed to sync user data");
          }
        } catch (error) {
          console.error("Error syncing user:", error);
        }
      };

      syncUser();
    }
  }, [isLoaded, user]);

  return { user, isLoaded };
}