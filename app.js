var fs = require('fs')
var system = require('system')
// Emulates node __dirname for casper
var currentFile = require('system').args[3]
var __dirname = fs.absolute(currentFile).split('/')
__dirname.pop()
__dirname = __dirname.join("/") + "/"
var cookiePath = __dirname + '/storage/cookies.json'
var token = null, mintEmail, mintPass
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
    onDie: function(casper, msg) {
        var obj = {
            'msg': msg,
            'error': true
        }
        var seen = [];

        obj = JSON.stringify(obj, function(key, val) {
            if (val != null && typeof val == "object") {
                if (seen.indexOf(val) >= 0) {
                    return;
                }
                seen.push(val);
            }
            return val;
        });

        casper.echo(obj)
        casper.exit(255)
    }
})

// Allow CLI options to override the options above
if (casper.cli.get('email') && casper.cli.get('password')) {
    mintEmail = casper.cli.get('email');
    mintPass  = casper.cli.get('password')
} else {
    casper.options.onDie(casper, 'You must enter an e-mail and password')
}

// Restore cookies from file
if (fs.isFile(cookiePath))
    phantom.cookies = JSON.parse(fs.read(cookiePath))

casper.start()
casper.thenOpen('https://wwws.mint.com/login.event', function() {
    this.on("resource.received", function(response) {
        if (token === null && response.url.indexOf('oauth2.xevent?token=') > -1) {
            var matches = response.url.match(/xevent\?token=(.*?)&/)
            token = matches[1]
        }
    })

    // Waits for login form
    this.waitForSelector("form input[name='Email']", function() {
        casper.log('Found login form')
        this.fillSelectors('form#ius-form-sign-in', {
            'input[name = Email]' :  mintEmail,
            'input[name = Password]' : mintPass
        }, true)

        // Waits to see if 2 factor auth is taking place. Will initiate the 2FA process and read the code from stdin
        this.waitForText('send you a code to verify', function() {
            this.click('#ius-mfa-options-submit-btn')

            this.waitForText('We sent a code to', function() {
                this.log('Enter the code you were texted / emailed', 'error')
                var code = system.stdin.readLine()

                this.fillSelectors('form#ius-mfa-otp-form', {
                    '#ius-mfa-confirm-code': code
                }, true)
            }, 50000)
        }, function() {
            this.log('Timeout waiting for 2FA. Either it failed or you didn\'t need it')
        }, 5000)
    }, function() {
        this.log('No login asked for -- probably already logged in')
    }, 5000)

    // Wait for token to exist in a URL, then proceed on to login
    this.waitFor(function() {
        return token === null ? false : true
    }, function() {
        this.log('Got a token!')
        getAccounts.call(this)
    }, function tokenTimeout() {
        this.die('Timeout waiting for token')
    }, 60000)
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
    }, 10000)

    return this
}

casper.run()

