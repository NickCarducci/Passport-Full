# Passport for Android

#### Publish under Monmouth University developer accoount

## Android Keystore

```
cd Android/app

keytool -genkey -v -keystore release.keystore -alias passport-key -keyalg RSA -keysize 2048 -validity 10000

// answer questions about Monmouth University as an organization representing this keystore

//Generating 2,048 bit RSA key pair and self-signed certificate (SHA384withRSA) with a validity of 10,000 days for: CN=Nicholas Carducci, OU=Sole Proprietor, O=Nicholas Carducci, L=Leonardo, ST=New Jersey, C=US [Storing release.keystore] (under app/)

base64 -i release.keystore | pbcopy
```

The keystore as base64 is now copied in your computer's clipboard. Go you your cloud repository (e.g. GitHub) and find the action secrets under settings and paste that base64 format keystore into:

`KEYSTORE_BASE64`

`KEYSTORE_PASSWORD` and `KEY_PASSWORD` are the same, whatever you made in keytool command.

`KEY_ALIAS` is passport-key.
