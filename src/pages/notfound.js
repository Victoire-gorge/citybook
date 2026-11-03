import '../styles/base.css';
import '../styles/adventures.css';
import { t } from '../lib/i18n.js';
import { cutout, startPage } from '../lib/ui.js';

startPage();
document.querySelector('[data-title]').append(cutout(t('notFound.title')));
