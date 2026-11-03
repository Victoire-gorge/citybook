import '../styles/base.css';
import '../styles/adventures.css';
import { mountMasthead, startPage } from '../lib/ui.js';

startPage();
mountMasthead(null, { signedIn: false });
