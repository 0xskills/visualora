# VisualORA - Orange.meme OG mining viewer  

VisualORA is simple app that displays $ORA mining transactions on Algorand.
It was put together for the participation for the [Orange Hackathon 2025](https://github.com/orangesmeme/ora-hackathon-2025)

## Installation

Clone repository and install dependencies

```
npm install
```

Generate self-signed certificate for local server
```
mkdir ssl
cd ssl
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -keyout private.key -out certificate.crt
uncomment server at vite.config.js
```
## Usage

```
npm run dev
```

