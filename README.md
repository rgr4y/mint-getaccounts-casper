# mint-getaccounts-casper
Uses CasperJS to scrape account information from Mint.com

## Running
`casperjs app.js`

## Installation

1. Install [CasperJS](http://docs.casperjs.org/en/latest/installation.html)
2. Run for the first time on the command line:
`casperjs app.js --email=YOUR_MINT_EMAIL --password=YOUR_MINT_PASSWORD`
3. You will be sent a text or e-mail with a code for 2 Factor Authentication. Enter this code into the CLI prompt.
4. The resulting JSON for your accounts will now output. After entering this code, your Casper browser will be saved. I don't know for how long,
but it may prompt again in the future. If it breaks, run it again on the CLI.
5. You can now run the script without prompt and JSON will output to stdout.

## Troubleshooting
- Set `verbose` to `true` and `logLevel` to `debug` if you're having issues.
- Delete `storage/cookies.json` if you're getting timeout errors
