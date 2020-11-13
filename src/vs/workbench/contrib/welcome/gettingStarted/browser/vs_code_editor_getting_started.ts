/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { escape } from 'vs/base/common/strings';
import { localize } from 'vs/nls';

export default () => `
<div class="gettingStartedContainer">
<div id="prev-button" class="scroll-button codicon codicon-chevron-left" x-dispatch="scrollPrev"></div>
<div id="next-button" class="scroll-button codicon codicon-chevron-right" x-dispatch="scrollNext"></div>
<div class="gettingStarted" role="document">
<div class="gettingStartedSlide">
<img/>
<div class="product-icon"></div>
<h1 class="caption">${escape(localize('gettingStarted.welcome', "Welcome to "))}<span id="product-name">${escape(localize('gettingStarted.vscode', "Visual Studio Code"))}</span></h1>
<p class="subtitle detail">${escape(localize({ key: 'gettingStarted.editingRedefined', comment: ['Shown as subtitle on the Welcome page.'] }, "Code editing. Redefined"))}</p>
<button class="next-step" x-dispatch="scrollNext">Get Started</button>
<a class="skip" x-dispatch="skip">Skip</a>
</div>
<div class="gettingStartedSlide next">
<h1 class="caption">${escape(localize('gettingStarted.commandPallete', "Command Palette"))}</h1>
<p class="subtitle detail">${escape(localize('gettingStarted.findAnyCommand', "Find any command, open files, and search for symbols"))}</p>
<button class="next-step" x-dispatch="scrollNext">Next Step</button>
<a class="skip" x-dispatch="skip">Skip</a>
</div>
<div class="gettingStartedSlide next">
<h1 class="caption">${escape(localize('gettingStarted.chooseTheme', "Choose a Theme"))}</h1>
<p class="subtitle detail">${escape(localize('gettingStarted.looktheWayYouLove', "Make the editor and your code look the way you love"))}</p>
<button x-dispatch="theme:light">Light</button>
<button x-dispatch="theme:dark">Dark</button>
<button x-dispatch="theme:other">Other</button>

|||js
const express = require('express');
const app = express();

app.get('/',  (req, res) => {
	res.send(|Hello \${req.}|);
});

app.listen(3000);
|||

<button class="next-step" x-dispatch="scrollNext">Next Step</button>
<a class="skip" x-dispatch="skip">Skip</a>
</div>
<div class="footer">
<a x-dispatch="signIn">
${escape(localize({ key: 'gettingStarted.signIn', comment: ['call to action to sign into settings sync'] }, "Sign in"))}
</a>
${(escape(localize({ key: 'gettingStarted.signIn.result', comment: ['result of clicking the "sign in" button'] }, "to turn on Settings Sync")))}
<a x-dispatch="signInInfo">(i)</a>
</div>
</div>
</div>
`.replace(/\|/g, '`');
