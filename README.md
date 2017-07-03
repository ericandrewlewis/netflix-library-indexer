# Netflix Library Crawler

This is a program that will get a list of all movie and TV show titles in Netflix's library.

## See the data

I've included the output of the crawler in the `output/` folder, split by genre as well as creating an [`output/All-Movies`](output/All-Movies) file.

## Running the crawler

[Install Selenium](http://docs.seleniumhq.org/download/) _Sorry, I think I had Selenium already installed, I'm not familiar with how to install it from scratch._

Install Firefox. This is the browser I use with Selenium.

Install [Node.js](https://nodejs.org).

Install dependencies

```
npm install
```

Create a `.env` file with the contents

```
FACEBOOK_EMAIL=
FACEBOOK_PASSWORD=
```

and fill in your Facebook email and password. I log into Netflix through my Facebook account, so the crawler currently has this requirement. If you log in to Netflix with a username and password, the crawler could be modified to use that instead.

Run the crawler

```
npm start
```

The crawler will go through all genre pages listed in the top-level navigation and put results into genre-specific files in the `output/` folder, as well as an aggregate `output/All-Movies` file.
