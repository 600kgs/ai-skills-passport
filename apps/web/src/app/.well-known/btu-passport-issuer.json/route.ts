// binds btu's passport signing identity to this domain. a verifier trusts the key
// because https on this domain says it's btu's, not because of a bare address.
import { issuerAddresses } from "@passport/core";

export type IssuerDocument = {
  issuer: string;
  domain: string;
  network: "devnet" | "mainnet";
  rpcUrl: string;
  authority: string;
  credential: string;
  schema: string;
};

export async function GET(req: Request) {
  const authority = process.env.AUTHORITY_ADDRESS;
  if (!authority) return Response.json({ error: "issuer not configured" }, { status: 503 });
  const { credential, schema } = await issuerAddresses(authority);
  const doc: IssuerDocument = {
    issuer: "Business and Technology University (BTU), hackathon test issuer",
    domain: new URL(req.url).host,
    network: process.env.SOLANA_RPC_URL?.includes("devnet") ? "devnet" : "mainnet",
    rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    authority, credential, schema,
  };
  return Response.json(doc, { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}
