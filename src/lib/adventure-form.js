// The create / edit form for an adventure, shown in a <dialog>.
import { t } from './i18n.js';
import { api } from './api.js';
import { esc, toast } from './ui.js';

export function openAdventureForm(dialog, { adventure = null, onSaved, onDeleted } = {}) {
  const form = dialog.querySelector('form');
  const a = adventure || { title: '', subtitle: '', starts_on: '', ends_on: '', party_size: 2, guests: [], notes: '' };
  form.innerHTML = `
    <div class="sheet__head"><h2>${esc(adventure ? t('form.editTitle') : t('form.newTitle'))}</h2></div>
    <div class="adventure-form__grid">
      <label class="span-2"><span>${esc(t('form.title'))}</span><input name="title" required maxlength="120" value="${esc(a.title)}" /></label>
      <label><span>${esc(t('form.starts'))}</span><input name="starts_on" type="date" required value="${esc(a.starts_on)}" /></label>
      <label><span>${esc(t('form.ends'))}</span><input name="ends_on" type="date" required value="${esc(a.ends_on)}" /></label>
      <label><span>${esc(t('form.party'))}</span><input name="party_size" type="number" min="1" max="50" required value="${esc(a.party_size)}" /></label>
      <label><span>${esc(t('form.guests'))}</span><input name="guests" maxlength="400" value="${esc(a.guests.join(', '))}" /></label>
      <label class="span-2"><span>${esc(t('form.notes'))}</span><textarea name="notes" rows="3" maxlength="4000">${esc(a.notes)}</textarea></label>
      <label class="span-2"><span>${esc(t('form.cover'))}</span><input name="cover" type="file" accept="image/jpeg,image/png,image/webp" /></label>
    </div>
    <p class="form-error" data-error role="alert" hidden></p>
    <div class="adventure-form__actions">
      ${adventure ? `<button class="btn btn--danger" type="button" data-delete>${esc(t('form.delete'))}</button>` : ''}
      <span class="spacer"></span>
      <button class="btn btn--line" type="button" data-cancel>${esc(t('form.cancel'))}</button>
      <button class="btn" type="submit">${esc(adventure ? t('form.save') : t('form.create'))}</button>
    </div>`;

  const error = form.querySelector('[data-error]');
  const fail = (msg) => {
    error.textContent = msg;
    error.hidden = false;
  };
  const starts = form.elements.starts_on;
  const ends = form.elements.ends_on;
  starts.addEventListener('change', () => {
    ends.min = starts.value;
    if (!ends.value || ends.value < starts.value) ends.value = starts.value;
  });
  ends.min = starts.value;

  form.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm(t('form.deleteConfirm', { title: adventure.title }))) return;
    await api(`/api/adventures/${adventure.id}`, { method: 'DELETE' });
    dialog.close();
    onDeleted?.();
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    error.hidden = true;
    const f = form.elements;
    const body = {
      title: f.title.value.trim(),
      starts_on: f.starts_on.value,
      ends_on: f.ends_on.value,
      party_size: Number(f.party_size.value),
      guests: f.guests.value.split(',').map((s) => s.trim()).filter(Boolean),
      notes: f.notes.value.trim(),
    };
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      const saved = adventure
        ? await api(`/api/adventures/${adventure.id}`, { method: 'PATCH', body })
        : await api('/api/adventures', { method: 'POST', body });
      const file = f.cover.files[0];
      if (file) {
        try {
          const { cover } = await api(`/api/adventures/${saved.id}/cover`, {
            method: 'PUT', body: file, raw: true, headers: { 'Content-Type': file.type },
          });
          saved.cover = cover;
        } catch {
          fail(t('form.coverError'));
          return;
        }
      }
      dialog.close();
      if (adventure) toast(t('form.saved'));
      onSaved?.(saved);
    } catch (err) {
      fail(err.message || t('error.generic'));
    } finally {
      submit.disabled = false;
    }
  };
  dialog.showModal();
  form.elements.title.focus();
}
