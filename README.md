### Yet Another Flags ###

The source code for Google Chrome [extenstion](https://chrome.google.com/webstore/detail/dmchcmgddbhmbkakammmklpoonoiiomk).

Extension show data from free [MaxMind City DB](http://www.maxmind.com/app/geolitecity)
files. Take a look at [server code](https://github.com/falsefalse/geoip-server) as well.

#### Install ####

Make sure you have [jake](https://github.com/mde/jake) installed globally.

    $ git clone git@bitbucket.org:false/yet-another-flags-extension.git
    $ cd yet-another-flags-extension
    $ npm install .
    $ jake && jake package

And you have it compiled in `./pkg`.

