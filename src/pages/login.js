import '../styles/base.css';
import '../styles/adventures.css';
import { api } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { cutout, startPage } from '../lib/ui.js';

startPage();
document.querySelector('[data-title]').append(cutout(t('login.title'), { size: 'l' }));

const form = document.querySelector('[data-form]');
const error = document.querySelector('[data-error]');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.hidden = true;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await api('/api/login', {
      method: 'POST',
      body: { email: form.elements.email.value, password: form.elements.password.value },
    });
    const next = new URLSearchParams(location.search).get('next');
    // Only follow local paths, never another site.
    location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  } catch {
    error.textContent = t('login.error');
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
});
