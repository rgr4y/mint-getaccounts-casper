
// Enter your login and password here
var mintUser = 'YOUR_USERNAME'
var mintPass = 'YOUR_PASSWORD'
//

var fs = require('fs')
var system = require('system')
var currentFile = require('system').args[3]
var __dirname = fs.absolute(currentFile).split('/')
__dirname.pop()
__dirname = __dirname.join("/") + "/"
var cookiePath = __dirname + '/storage/cookies.json'
var now = Math.floor(Date.now() / 1000)
var token = null
var request_id = 42
var casper = require('casper').create({
    //verbose: true,
    //logLevel: 'debug',
    pageSettings: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36'
    },
    onRunComplete: function() {
        // Save cookies
        fs.write(cookiePath, JSON.stringify(phantom.cookies), 644)
        this.exit(0)
    },
    onDie: function(msg) {
        this.echo(JSON.stringify({
            msg: msg,
            error: true
        }))
        this.exit(255)
    }
})

// Restore cookies from file
if (fs.isFile(cookiePath))
    phantom.cookies = JSON.parse(fs.read(cookiePath))

casper.start()
casper.thenOpen('https://wwws.mint.com/login.event', function() {
    this.on("resource.received", function(response) {
        if (response.url.indexOf('oauth2.xevent?token=') > -1) {
            var matches = response.url.match(/xevent\?token=(.*?)&/)
            token = matches[1]
        }
    })

    this.waitFor(function() {
        return token === null ? false : true
    }, function() {
        this.log('Got a token!')

        this.waitForSelector("form input[name='Email']", function() {
            this.fillSelectors('form#ius-form-sign-in', {
                'input[name = Email ]' :  mintUser,
                'input[name = Password ]' : mintPass
            }, true)
        }, function() {
            this.log('No login asked for -- already logged in')
        })

        this.waitForText('send you a code to verify', function() {
            this.click('#ius-mfa-options-submit-btn')

            this.waitForText('We sent a code to', function() {
                this.log('Enter the code you were texted / emailed', 'error')
                var code = system.stdin.readLine()

                this.fillSelectors('form#ius-mfa-otp-form', {
                    '#ius-mfa-confirm-code': code
                }, true)

                getAccounts.call(this)
            })
        }, function timeout() {
            getAccounts.call(this)
        })
    }, function tokenTimeout() {
        this.die('Timeout waiting for token')
    })
})

function getAccounts()
{
    this.log('getAccounts')

    var input = {
        'args': {
            'types': [
                'BANK',
                'CREDIT',
                'INVESTMENT',
                'LOAN',
                'MORTGAGE',
                'OTHER_PROPERTY',
                'REAL_ESTATE',
                'VEHICLE',
                'UNCLASSIFIED'
            ]
        },
        'id': request_id.toString(),
        'service': 'MintAccountService',
        'task': 'getAccountsSorted'
    }

    // We're in! Now let's get account info
    this.waitForSelector('.moduleAccount .accounts-list', function() {
        this.thenOpen('https://wwws.mint.com/bundledServiceController.xevent?legacy=false&token=' + token,
          {
              method: 'POST',
              data: {
                  'input': JSON.stringify([input])
              }
          },
          function() {
              var json = JSON.parse(this.getPageContent())

              if (!json || !json.response[request_id] || json.response.errorCode) {
                  this.die(this.getPageContent())
                  return this
              }

              this.echo(JSON.stringify(json.response[request_id].response))
              request_id++
          }
        )
    })

    return this
}

casper.run()
