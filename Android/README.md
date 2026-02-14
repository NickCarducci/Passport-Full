# Passport for Android

#### Publish under Monmouth University developer accoount

## Android Keystore

```
keytool -genkey -v -keystore release.keystore -alias passport-key -keyalg RSA -keysize 2048 -validity 10000

// answer questions about Monmouth University as an organization representing this keystore

//Generating 2,048 bit RSA key pair and self-signed certificate (SHA384withRSA) with a validity of 10,000 days for: CN=Nicholas Carducci, OU=Sole Proprietor, O=Nicholas Carducci, L=Leonardo, ST=New Jersey, C=US [Storing release.keystore] (under app/)
```
