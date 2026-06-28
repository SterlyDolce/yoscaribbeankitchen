import crypto from "crypto";

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const ecdh = crypto.createECDH("prime256v1");
ecdh.generateKeys();

console.log(`WEB_PUSH_PUBLIC_KEY=${base64UrlEncode(ecdh.getPublicKey())}`);
console.log(`WEB_PUSH_PRIVATE_KEY=${base64UrlEncode(ecdh.getPrivateKey())}`);
