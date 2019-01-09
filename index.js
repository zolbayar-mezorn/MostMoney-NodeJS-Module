/// ///////////////////////////
//   Zolbayar Odonsuren      //
//        Mezorn LLC         //
/// ///////////////////////////
'use strict'
const axios = require('axios')
const crypto = require('crypto')
const sha1 = require('sha1')
const Nodersa = require('node-rsa')
const fs = require('fs')
const select = require('xml-crypto').xpath
const dom = require('xmldom')
const SignedXml = require('xml-crypto').SignedXml
const FileKeyInfo = require('xml-crypto').FileKeyInfo

/// ///////////////////////////
//   UBCAB3.0   2018-10-30  //
/// ///////////////////////////
//   MOSTMONEY INTEGRATION  //
/// ///////////////////////////

// API Host and Contants
const BASE_URL = 'http://most-api-url-here' // Most-оос авна
const ENCRYPTED_FIELDS = ['traceNo', 'qrAccountNumber', 'qrCode', 'srcMsisdn', 'tan']
const PAYEE_ID = '11111'    // Most-оос авна
const POS_ID = '11111'      // Most-оос авна
const SRC_INST_ID = '11111' // Most-оос авна
const CURRENCY = 'MNT'
const QR_COLOR = '#20733F'

// MostMonay public cert pem file converted by xml to pem online convertor
const mostcert = process.env.project_root + '/payment/mostmoney/mostcert.pem'
const mostcertVerify = process.env.project_root + '/payment/mostmoney/server.crt'

// Encode with Public key
function encryptStringWithRsaPublicKey (toEncrypt) {
  // import keyfile
  let key = new Nodersa()
  let keyfile = fs.readFileSync(mostcert, 'ascii')
  key.importKey(keyfile)

  // padding mode, not OEAP
  key.setOptions({ encryptionScheme: 'pkcs1' })

  // encode ascii binary
  let bufferToEncrypt = Buffer.from(toEncrypt, 'ascii')
  return key.encrypt(bufferToEncrypt, 'base64', 'ascii')
}

// Encrypt single key
function encrypt (data) {
  // ciphering
  let databuff = Buffer.from(JSON.stringify(data).trim(), 'utf8')
  let key = Buffer.from(data.traceNo, 'utf8')
  let iv = Buffer.from([0xA1, 0xE2, 0xD5, 0xFE, 0xDA, 0x52, 0x0A, 0x8F, 0x8A, 0x19, 0xAA, 0xBB, 0x0A, 0xD0, 0x55, 0xAC])
  let cipher = crypto.createCipheriv('aes-128-cbc', key, iv)
  let encrypted = cipher.update(databuff)
  encrypted = Buffer.concat([encrypted, cipher.final()])

  // MostPUblic key encode
  let ek = encryptStringWithRsaPublicKey(data.traceNo)

  // Hash
  let sg = sha1(databuff)
  return {
    'SD': encrypted.toString('base64'),
    'EK': ek,
    'SG': Buffer.from(sg, 'hex').toString('base64')
  }
}
function extend (obj, src) {
  Object.keys(src).forEach(function (key) { obj[key] = src[key] })
  return obj
}
// Search and replace all sensitive fields in dictionary with encrypted one
function encryptParams (params) {
  let toEncrypt = {}
  ENCRYPTED_FIELDS.forEach(function (item, index) {
    if (item in params) {
      toEncrypt[item] = params[item]
      delete params[item]
    }
  })
  return JSON.stringify(extend(params, encrypt(toEncrypt)))
}
// filter parameters
function configureParams (params, mandatoryFields, optionalFields = []) {
  let processedParams = {}
  Object.keys(params).forEach(function (item, index) {
    if ((mandatoryFields + optionalFields).includes(item) && params[item] != null) { processedParams[item] = params[item] }
  })
  return processedParams
}
// API call function
function callApi (path, params = null, callback) {
  params = encryptParams(params, path)
  let headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Charset': 'utf-8',
    'User-Agent': 'most_ots/#1 node/#1.0'
  }
  axios.defaults.headers.post['Content-Type'] = 'application/json'
  axios.defaults.headers.post['TT'] = path.split('TT')[1]
  axios.defaults.headers.post['RS'] = '00'
  axios.defaults.headers.post['PV'] = '05'
  axios.post(path, params, headers)
    .then(function (response) {
      console.log(response.data)
      callback(null, response.data)
    })
    .catch(function (error) {
      if (error.response) {
        console.log(error.response.data)
        console.log(error.response.status)
        console.log(error.response.headers)
        callback(error, null)
      } else if (error.request) {
        console.log(error.request)
        callback(error, null)
      } else {
        console.log('Error', error.message)
        callback(error, null)
      }
      console.log(error.config)
      callback(error, null)
    })
}

// API QR generate TT3051
// mp - mandatory fields, op - optional fields
function generateQr (traceNo, billId, amount, desc, lang, callback) {
  let url = BASE_URL + '/TT3051'
  let requestBody = {
    'tranCur': CURRENCY,
    'tranAmount': amount, // amount **.00
    'tranDesc': desc,     // desc
    'qrPaidLimit': '0',   // 0 no limit
    'qrColor': QR_COLOR,
    'qrSize': '100',
    'payeeId': PAYEE_ID,
    'posNo': POS_ID,
    'traceNo': traceNo,   // unique for every request trace no : string
    'billId': billId,     // unique for every QR invoice string
    'channel': '44',
    'lang': lang          // language code "0"-mn, "1"-en
  }
  let mp = ['srcInstId', 'channel', 'lang', 'traceNo', 'payeeId', 'posNo', 'tranAmount', 'tranCur', 'tranDesc']
  let op = ['billId', 'deviceIP', 'deviceMac', 'deviceName']
  callApi(url, configureParams(requestBody, mp, op), callback)
}

// API QR generate TT3061
function transferQr (traceNo, amount, desc, lang, callback) {
  let url = BASE_URL + '/TT3061'
  let requestBody = {
    'tranCur': CURRENCY,
    'tranAmount': amount, // amount **.00
    'tranDesc': desc,     // desc
    'qrPaidLimit': '0',   // 0 no limit
    'qrColor': QR_COLOR,
    'qrSize': '100',
    'payeeId': PAYEE_ID,
    'posNo': POS_ID,
    'traceNo': traceNo,   // unique trace no : string
    'channel': '44',
    'lang': lang          // language code "0"-mn, "1"-en
  }
  let mp = ['srcInstId', 'channel', 'lang', 'traceNo', 'qrBankCode', 'qrAccountName', 'qrAccountNumber', 'tranAmount', 'tranCur']
  let op = ['tranDesc']
  callApi(url, configureParams(requestBody, mp, op), callback)
}

// API QR generate TT3064
function waitPaymentProcess (traceNo, amount, desc, lang, callback) {
  let url = BASE_URL + '/TT3064'
  let requestBody = {
    'tranCur': CURRENCY,
    'tranAmount': amount, // amount **.00
    'tranDesc': desc,     // desc
    'qrPaidLimit': '0',   // 0 no limit
    'qrColor': QR_COLOR,
    'qrSize': '100',
    'payeeId': PAYEE_ID,
    'posNo': POS_ID,
    'traceNo': traceNo,   // unique trace no : string
    'channel': '44',
    'lang': lang          // language code "0"-mn, "1"-en
  }
  let mp = ['srcInstId', 'channel', 'lang', 'qrBankCode', 'qrAccountName', 'qrAccountNumber', 'tranAmount', 'tranCur']
  let op = ['tranDesc']
  callApi(url, configureParams(requestBody, mp, op), callback)
}

// API QR generate TT3065 QR codoor tulbur lavlah
function checkQrPayment (traceNo, billId, qr, lang, callback) {
  let url = BASE_URL + '/TT3065'
  let requestBody = {
    'srcInstId': SRC_INST_ID,
    'qrCode': qr,         // qr number
    'isCheckQr': 1,       // tologdsong shalgah bol 1 tsutslah bol 0
    'billId': billId,
    'payeeId': PAYEE_ID,
    'posNo': POS_ID,
    'traceNo': traceNo,   // unique trace no : string
    'channel': '44',
    'lang': lang          // language code "0"-mn, "1"-en
  }
  let mp = ['srcInstId', 'channel', 'lang', 'traceNo', 'qrCode', 'payeeId', 'posNo', 'billId', 'isCheckQr']
  let op = ['deviceIP', 'deviceMac', 'deviceName']
  callApi(url, configureParams(requestBody, mp, op), callback)
}

// API QR generate TT3066 QR codoor tulbur lavlah batch process
function checkQrPaymentBatch (traceNo, amount, desc, lang, callback) {
  let url = BASE_URL + '/TT3066'
  let requestBody = {
    'tranCur': CURRENCY,
    'tranAmount': amount, // amount **.00
    'tranDesc': desc,     // desc
    'qrPaidLimit': '0',   // 0 no limit
    'qrColor': QR_COLOR,
    'qrSize': '100',
    'payeeId': PAYEE_ID,
    'posNo': POS_ID,
    'traceNo': traceNo,   // unique trace no : string
    'channel': '44',
    'lang': lang          // language code "0"-mn, "1"-en
  }
  let mp = ['srcInstId', 'channel', 'lang', 'traceNo', 'qrCode', 'payeeId', 'posNo', 'isCheckQr']
  let op = ['deviceIP', 'deviceMac', 'deviceName']
  callApi(url, configureParams(requestBody, mp, op), callback)
}

// API QR generate TT1608 TanCodoor hudalan avalt hiih huselt
function purchaseTan (billId, traceNo, amount, desc, phone, tan, lang, callback) {
  let url = BASE_URL + '/TT1608'
  let requestBody = {
    'srcInstId': SRC_INST_ID,
    'tranAmount': amount, // amount **.00
    'tranCur': CURRENCY,
    'tranDesc': desc,
    'billId': billId,     // billId
    'srcMsisdn': phone,   // Phone number
    'tan': tan,
    'payeeId': PAYEE_ID,
    'posNo': POS_ID,
    'traceNo': traceNo,   // unique trace no : string
    'channel': '4',
    'lang': lang          // language code "0"-mn, "1"-en
  }
  let mp = ['srcInstId', 'channel', 'lang', 'traceNo', 'payeeId', 'posNo', 'srcMsisdn', 'tan', 'tranAmount', 'tranCur']
  let op = ['billId', 'tranDesc', 'deviceIP', 'deviceMac', 'deviceName']
  callApi(url, configureParams(requestBody, mp, op), callback)
}

function isValid (xmlbody) {
  let doc = new dom.DOMParser().parseFromString(xmlbody)

  let signature = select(doc, "/*/*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']")[0]
  let sig = new SignedXml()
  sig.keyInfoProvider = new FileKeyInfo(mostcertVerify)
  sig.loadSignature(signature.toString())
  let res = sig.checkSignature(xmlbody)
  if (!res) console.log(sig.validationErrors)
  return Promise.resolve(res)
}

module.exports.generateQr = generateQr
module.exports.transferQr = transferQr
module.exports.waitPaymentProcess = waitPaymentProcess
module.exports.checkQrPayment = checkQrPayment
module.exports.checkQrPaymentBatch = checkQrPaymentBatch
module.exports.purchaseTan = purchaseTan
module.exports.isValid = isValid
