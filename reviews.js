import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const config = window.NAILSDOKUMA_SUPABASE_CONFIG || {};
const ready = Boolean(config.url && config.publishableKey);
const supabase = ready ? createClient(config.url, config.publishableKey) : null;
const list = document.getElementById('review-list');
const carouselControls = document.getElementById('review-controls');
const previousButton = document.getElementById('review-prev');
const nextButton = document.getElementById('review-next');
const carouselPosition = document.getElementById('review-position');
let approvedCount = 0;
const formPanel = document.getElementById('review-form-panel');
const form = document.getElementById('review-form');
const feedback = document.getElementById('review-feedback');
const openButton = document.getElementById('review-open');
const submitButton = document.getElementById('review-submit');
const nameInput = document.getElementById('review-name');
const textInput = document.getElementById('review-text');
const count = document.getElementById('review-count');
let language = document.documentElement.lang === 'uk' ? 'ua' : 'tr';

const copy = {
  tr: {
    config: 'Yorum formu henüz kullanıma açılmadı. Lütfen daha sonra tekrar deneyin.',
    loading: 'Yorumlar yükleniyor…', empty: 'Henüz yayınlanmış yorum yok. İlk yorumu siz bırakın.',
    error: 'Yorumlar yüklenemedi. Lütfen daha sonra tekrar deneyin.',
    missing: 'Lütfen adınızı, 1-5 yıldız puanınızı ve en az 10 karakterlik yorumunuzu girin.',
    honeypot: 'Gönderiminiz alınamadı.',
    wait: 'Yeni bir yorum göndermeden önce lütfen biraz bekleyin.',
    success: 'Teşekkürler! Yorumunuz gönderildi ve yayınlanmadan önce onay bekliyor.',
    submit: 'Gönderiliyor…', stars: 'yıldız',
    errorSubmit: 'Yorum gönderilemedi. Lütfen alanları kontrol edip tekrar deneyin.',
    date: 'tr-TR', previous: 'Önceki yorumlar', next: 'Sonraki yorumlar', range: (start, end, total) => `Gösterilen ${start}-${end} / ${total}`
  },
  ua: {
    config: 'Форма відгуків ще не налаштована. Спробуйте, будь ласка, пізніше.',
    loading: 'Завантажуємо відгуки…', empty: 'Поки що опублікованих відгуків немає. Залиште перший',
    error: 'Не вдалося завантажити відгуки. Спробуйте, будь ласка, пізніше.',
    missing: 'Вкажіть ім’я, оцінку від 1 до 5 зірок і відгук довжиною щонайменше 10 символів.',
    honeypot: 'Не вдалося надіслати відгук.',
    wait: 'Зачекайте трохи перед наступним відгуком.',
    success: 'Дякуємо! Відгук надіслано, він з’явиться після схвалення.',
    submit: 'Надсилаємо…', stars: 'зірок',
    errorSubmit: 'Не вдалося надіслати відгук. Перевірте поля й спробуйте ще раз.',
    date: 'uk-UA', previous: 'Попередні відгуки', next: 'Наступні відгуки', range: (start, end, total) => `Показано ${start}-${end} із ${total}`
  }
};
const t = () => copy[language];

function setFeedback(message, success = false) {
  feedback.textContent = message;
  feedback.classList.toggle('success', success);
}
function setLanguage(next) {
  language = next === 'ua' ? 'ua' : 'tr';
  nameInput.placeholder = language === 'tr' ? nameInput.dataset.placeholderTr : nameInput.dataset.placeholderUa;
  textInput.placeholder = language === 'tr' ? textInput.dataset.placeholderTr : textInput.dataset.placeholderUa;
  list.setAttribute('aria-label', language === 'tr' ? 'Müşteri yorumları' : 'Відгуки клієнток');
  previousButton.setAttribute('aria-label', t().previous);
  nextButton.setAttribute('aria-label', t().next);
  renderReviews();
}
window.addEventListener('nailsdokuma:languagechange', event => setLanguage(event.detail?.language));

function visibleReviewCount() {
  if (window.matchMedia('(max-width: 560px)').matches) return 1;
  if (window.matchMedia('(max-width: 820px)').matches) return 2;
  return 3;
}
function updateCarouselControls() {
  const canScroll = approvedCount > visibleReviewCount();
  carouselControls.hidden = !canScroll;
  if (!canScroll) return;
  const card = list.querySelector('.review-card');
  const step = card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(list).columnGap || '0') : list.clientWidth;
  const first = step ? Math.round(list.scrollLeft / step) : 0;
  const shown = visibleReviewCount();
  carouselPosition.textContent = t().range(Math.min(first + 1, approvedCount), Math.min(first + shown, approvedCount), approvedCount);
  previousButton.disabled = list.scrollLeft <= 2;
  nextButton.disabled = list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
}
list.addEventListener('scroll', () => requestAnimationFrame(updateCarouselControls), { passive: true });
previousButton.addEventListener('click', () => list.scrollBy({ left: -list.clientWidth, behavior: 'smooth' }));
nextButton.addEventListener('click', () => list.scrollBy({ left: list.clientWidth, behavior: 'smooth' }));
window.addEventListener('resize', updateCarouselControls);

function renderCard(review) {
  const article = document.createElement('article');
  article.className = 'review-card';
  const stars = document.createElement('div');
  stars.className = 'review-stars';
  stars.setAttribute('aria-label', `${review.rating} ${t().stars}`);
  stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const quote = document.createElement('blockquote');
  quote.textContent = review.review_text;
  const meta = document.createElement('div');
  meta.className = 'review-meta';
  const name = document.createElement('strong');
  name.textContent = review.customer_name;
  const date = document.createElement('time');
  date.dateTime = review.created_at;
  date.textContent = new Date(review.created_at).toLocaleDateString(t().date, { year: 'numeric', month: 'short', day: 'numeric' });
  meta.append(name, date);
  article.append(stars, quote, meta);
  return article;
}
async function renderReviews() {
  list.classList.remove('is-message');
  list.replaceChildren();
  if (!ready) {
    const message = document.createElement('p');
    message.className = 'review-state';
    message.textContent = t().config;
    approvedCount = 0;
    carouselControls.hidden = true;
    list.append(message);
    return;
  }
  const loading = document.createElement('p');
  loading.className = 'review-state';
  loading.textContent = t().loading;
  list.classList.add('is-message');
  list.append(loading);
  const { data, error } = await supabase.from('reviews')
    .select('id, customer_name, rating, review_text, created_at')
    .eq('status', 'approved').order('created_at', { ascending: false });
  list.replaceChildren();
  list.classList.remove('is-message');
  if (error) {
    approvedCount = 0;
    carouselControls.hidden = true;
    const message = document.createElement('p');
    message.className = 'review-state';
    message.textContent = t().error;
    list.classList.add('is-message');
    list.append(message);
    return;
  }
  if (!data?.length) {
    approvedCount = 0;
    carouselControls.hidden = true;
    const message = document.createElement('p');
    message.className = 'review-state';
    message.textContent = t().empty;
    list.classList.add('is-message');
    list.append(message);
    return;
  }
  approvedCount = data.length;
  data.forEach(review => list.append(renderCard(review)));
  requestAnimationFrame(updateCarouselControls);
}

openButton.addEventListener('click', () => {
  const opening = formPanel.hidden;
  formPanel.hidden = !opening;
  openButton.setAttribute('aria-expanded', String(opening));
  if (opening) nameInput.focus();
});
document.getElementById('review-cancel').addEventListener('click', () => {
  formPanel.hidden = true;
  openButton.setAttribute('aria-expanded', 'false');
  setFeedback('');
  openButton.focus();
});
textInput.addEventListener('input', () => { count.textContent = String(textInput.value.length); });

form.addEventListener('submit', async event => {
  event.preventDefault();
  setFeedback('');
  if (!ready) return setFeedback(t().config);
  if (!form.reportValidity()) return setFeedback(t().missing);
  if (document.getElementById('review-website').value) return setFeedback(t().honeypot);
  const lastSubmission = Number(localStorage.getItem('nailsdokuma-review-last-submit') || 0);
  if (Date.now() - lastSubmission < 30000) return setFeedback(t().wait);
  const rating = Number(new FormData(form).get('rating'));
  const customerName = nameInput.value.trim();
  const reviewText = textInput.value.trim();
  if (customerName.length < 2 || customerName.length > 60 || !Number.isInteger(rating) || rating < 1 || rating > 5 || reviewText.length < 10 || reviewText.length > 1000) {
    return setFeedback(t().missing);
  }
  submitButton.disabled = true;
  submitButton.textContent = t().submit;
  const { error } = await supabase.from('reviews').insert({
    customer_name: customerName,
    rating,
    review_text: reviewText,
    language
  });
  submitButton.disabled = false;
  submitButton.textContent = language === 'tr' ? 'Yorumu gönder' : 'Надіслати відгук';
  if (error) return setFeedback(t().errorSubmit);
  localStorage.setItem('nailsdokuma-review-last-submit', String(Date.now()));
  form.reset();
  count.textContent = '0';
  setFeedback(t().success, true);
});

nameInput.placeholder = nameInput.dataset.placeholderTr;
textInput.placeholder = textInput.dataset.placeholderTr;
renderReviews();
