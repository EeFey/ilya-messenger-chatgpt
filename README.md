# Ilya Messenger ChatGPT
Easily convert a personal Facebook account into an auto reply chat bot using ChatGPT.

<p align="left" width="100%">
    <img width="600px" src="https://github.com/EeFey/ilya-messenger-chatgpt/assets/16509521/9dec4668-1c91-44ac-96f3-e36cec4fa366">
</p>

## Features
- Keyword Activation - Prompt ChatGPT to respond using specific keywords
- Web Search Enabled - ChatGPT can retrieve the latest information from Google (Works with GPT-3.5)
- Multiple Roles - Define multiple ChatGPT personalities triggered with keywords
- Autoreply Mode - Define probability for ChatGPT to respond without specific keywords
- Referenced Reply Mode - Prompt ChatGPT while referencing a specific message through messenger reply
- Context Memory - ChatGPT retains and considers recent chat history
- Messenger Session Check - Regularly check to keep messenger active

## Quick setup
You will need to fill in the *OPENAI API KEY* and *FACEBOOK CREDENTIALS* in the `.env` file.<br />
For the *FACEBOOK CREDENTIALS*, you can use either `FB COOKIE` or `FB EMAIL PASSWORD`, or both.<br />
Using `FB COOKIE` is recommended, you can obtain the cookies using [J2TEAM Cookies](https://chrome.google.com/webstore/detail/j2team-cookies/okpidcojinmlaakglciglbpcpajaibco).

Then, to install the necessary packages, run 
```
npm install
```
To start the application, run
```
npm run start
```
