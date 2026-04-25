function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMonthLabel(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getCalendarGrid(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const cells = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ day: '', muted: true, today: false });
  }

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      muted: false,
      today: year === todayYear && month === todayMonth && day === todayDate,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: '', muted: true, today: false });
  }

  return cells;
}

export function createCalendarToolModal() {
  let calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  function renderCalendar(root) {
    const monthEl = root.querySelector('#tool-calendar-month');
    const gridEl = root.querySelector('#tool-calendar-grid');

    if (!monthEl || !gridEl) return;

    monthEl.textContent = getMonthLabel(calendarDate);
    gridEl.innerHTML = getCalendarGrid(calendarDate)
      .map((cell) => `
        <div class="tool-calendar__day${cell.muted ? ' is-muted' : ''}${cell.today ? ' is-today' : ''}">
          ${escapeHtml(cell.day)}
        </div>
      `)
      .join('');
  }

  return {
    id: 'calendar',
    title: 'Calendar',
    subtitle: 'See dates at a glance',
    description: 'Browse months and keep track of today.',
    badge: 'Date',
    render() {
      return `
        <div class="tool-utility-card hidden" data-tool-modal="calendar" role="dialog" aria-modal="true" aria-labelledby="tool-calendar-title">
          <div class="tool-utility-card__header">
            <div>
              <p class="tool-utility-card__eyebrow">Calendar</p>
              <h2 id="tool-calendar-title" class="tool-utility-card__title">Monthly Calendar</h2>
            </div>
            <button type="button" class="tool-utility-card__close" data-close-utility aria-label="Close dialog">×</button>
          </div>
          <div class="tool-utility-card__body">
            <div class="tool-calendar__toolbar">
              <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-calendar-nav="prev">Previous</button>
              <div class="tool-calendar__month" id="tool-calendar-month"></div>
              <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-calendar-nav="next">Next</button>
            </div>
            <div class="tool-calendar__weekdays">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>
            <div class="tool-calendar__grid" id="tool-calendar-grid"></div>
          </div>
        </div>
      `;
    },
    init(root) {
      renderCalendar(root);

      root.addEventListener('click', (event) => {
        const navButton = event.target.closest('[data-calendar-nav]');
        if (!navButton) return;

        calendarDate = new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth() + (navButton.dataset.calendarNav === 'next' ? 1 : -1),
          1
        );

        renderCalendar(root);
      });
    },
    onOpen(root) {
      renderCalendar(root);
    },
  };
}
