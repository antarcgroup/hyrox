// Shared cloud storage for the training tracker, backed by Netlify Blobs.
// GET  -> returns the shared training data (done + logs for both partners)
// POST -> saves the shared training data
//
// This is what makes Lulu and Ye Lu actually see each other's records,
// and what stops data disappearing when a phone or browser changes.

import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const EMPTY = { done: {}, logs: {} };

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS });
  }

  let store;
  try {
    store = getStore({ name: "hyrox", consistency: "strong" });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Blob store unavailable: " + err.message }),
      { status: 500, headers: CORS }
    );
  }

  // --- read ---
  if (req.method === "GET") {
    try {
      const data = await store.get("training", { type: "json" });
      return new Response(JSON.stringify(data || EMPTY), {
        status: 200,
        headers: CORS,
      });
    } catch (err) {
      // No data saved yet, or a transient read failure: start clean.
      return new Response(JSON.stringify(EMPTY), { status: 200, headers: CORS });
    }
  }

  // --- write ---
  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: CORS,
      });
    }

    // Only persist the two shapes we expect. Guards against a malformed
    // payload wiping the record.
    const clean = {
      done: body && typeof body.done === "object" && body.done ? body.done : {},
      logs: body && typeof body.logs === "object" && body.logs ? body.logs : {},
    };

    try {
      await store.setJSON("training", clean);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: CORS,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Save failed: " + err.message }),
        { status: 500, headers: CORS }
      );
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: CORS,
  });
};

export const config = { path: "/api/data" };
