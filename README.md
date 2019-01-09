# MostMoney-NodeJS-Module
Usage Example

```
import most from './index.js'

let traceNo = "2018111516121213"    // 16 оронтой unique гүйлгээний дугаар
let billId = "20181115161213"       // 14 оронтой unique дотоодын билл дугаар
let amount = "1000"                 // үнийн дүн
let description = "Таксины төлбөр"  // гүйлгээний тайлбар текст
let language = "0" // (0-mn, 1-en)  // хэлний сонголт

most.generateQr(traceNo, billId, amount, description, language, function (err, data) {
    if (err) return console('Error on the server.')
    if (data) {
      if (data.responseCode === '0') {
        let qr = JSON.parse(data.responseData)
        let deeplink = 'most://q?qPay_QRcode=' + qr.qr_code + '&object_type=&object_id='
      } else { console.log(data.responseCode) }
    } else { console.log('no data') }
})
```
