// نظام Pomodoro Timer المتقدم
export class PomodoroTimer {
  constructor() {
    this.studyTime = 25; // دقائق افتراضية
    this.breakTime = 10; // دقائق الراحة
    this.currentTime = 0;
    this.isRunning = false;
    this.isBreakTime = false;
    this.interval = null;
    this.currentTask = null;
    this.session = null;
    this.notifications = [];
    this.wakeLock = null;
    
    this.initNotifications();
  }

  // طلب صلاحية الإشعارات
  async initNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    
    // منع إغلاق الشاشة أثناء المراجعة
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.log('Wake lock failed:', err);
      }
    }
  }

  // بدء جلسة مراجعة جديدة
  startSession(task, studyMinutes = 25) {
    this.currentTask = task;
    this.studyTime = studyMinutes;
    this.currentTime = studyMinutes * 60; // تحويل للثواني
    this.isBreakTime = false;
    this.isRunning = true;
    
    // حفظ الجلسة في localStorage
    this.session = {
      taskId: task.id,
      taskName: task.subjectName || task.subjectId,
      startTime: Date.now(),
      studyTime: studyMinutes,
      breakTime: this.breakTime,
      notes: '',
      completed: false
    };
    
    localStorage.setItem('pomodoroSession', JSON.stringify(this.session));
    
    this.startTimer();
    this.showStudyInterface();
    this.sendNotification('🍅 بدأت جلسة المراجعة!', `${this.session.taskName} - ${studyMinutes} دقيقة`);
  }

  // بدء العداد
  startTimer() {
    if (this.interval) clearInterval(this.interval);
    
    this.interval = setInterval(() => {
      if (this.currentTime > 0) {
        this.currentTime--;
        this.updateDisplay();
        this.updateTitle();
      } else {
        this.timeUp();
      }
    }, 1000);
  }

  // عند انتهاء الوقت
  timeUp() {
    this.isRunning = false;
    clearInterval(this.interval);
    
    if (!this.isBreakTime) {
      // انتهت فترة المراجعة - بدء الراحة
      this.startBreak();
    } else {
      // انتهت فترة الراحة - العودة للمراجعة أو الانتهاء
      this.breakEnded();
    }
  }

  // بدء فترة الراحة
  startBreak() {
    this.isBreakTime = true;
    this.currentTime = this.breakTime * 60;
    this.isRunning = true;
    
    this.sendNotification('☕ وقت الراحة!', `${this.breakTime} دقائق راحة`);
    this.showBreakInterface();
    this.startTimer();
  }

  // انتهاء فترة الراحة
  breakEnded() {
    this.sendNotification('📚 انتهت الراحة!', 'هل تريد جلسة أخرى؟');
    this.showSessionComplete();
  }

  // إيقاف مؤقت
  pauseTimer() {
    this.isRunning = false;
    clearInterval(this.interval);
    this.updatePauseButton();
  }

  // استئناف المؤقت
  resumeTimer() {
    this.isRunning = true;
    this.startTimer();
    this.updatePauseButton();
  }

  // إنهاء الجلسة
  endSession(completed = false) {
    this.isRunning = false;
    clearInterval(this.interval);
    
    if (this.session) {
      this.session.completed = completed;
      this.session.endTime = Date.now();
      this.saveSessionHistory();
    }
    
    localStorage.removeItem('pomodoroSession');
    this.hideStudyInterface();
    
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
  }

  // حفظ سجل الجلسات
  saveSessionHistory() {
    const history = JSON.parse(localStorage.getItem('pomodoroHistory') || '[]');
    history.push(this.session);
    
    // الاحتفاظ بآخر 50 جلسة فقط
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    
    localStorage.setItem('pomodoroHistory', JSON.stringify(history));
  }

  // تحديث العرض
  updateDisplay() {
    const minutes = Math.floor(this.currentTime / 60);
    const seconds = this.currentTime % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // تحديث العرض في الواجهة
    const timerDisplay = document.getElementById('pomodoroTimeDisplay');
    const progressBar = document.getElementById('pomodoroProgress');
    
    if (timerDisplay) {
      timerDisplay.textContent = timeStr;
    }
    
    if (progressBar) {
      const totalTime = this.isBreakTime ? this.breakTime * 60 : this.studyTime * 60;
      const progress = ((totalTime - this.currentTime) / totalTime) * 100;
      progressBar.style.width = `${progress}%`;
    }
  }

  // تحديث عنوان الصفحة
  updateTitle() {
    const minutes = Math.floor(this.currentTime / 60);
    const seconds = this.currentTime % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    const status = this.isBreakTime ? '☕ راحة' : '📚 مراجعة';
    
    document.title = `${timeStr} - ${status} - ${this.session?.taskName || 'Pomodoro'}`;
  }

  // إرسال إشعار
  async sendNotification(title, body) {
    // إشعار عبر Service Worker (يعمل حتى عند إغلاق المتصفح)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          registration.active?.postMessage({
            type: 'POMODORO_NOTIFICATION',
            title,
            body,
            icon: '/assets/icons/icon-192.png',
            badge: '/assets/icons/notification.png'
          });
        }
      } catch (err) {
        console.log('Service Worker notification failed:', err);
      }
    }
    
    // إشعار المتصفح كـ fallback
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/notification.png',
        tag: 'pomodoro',
        requireInteraction: true
      });
      
      // إغلاق الإشعار بعد 10 ثوان
      setTimeout(() => notification.close(), 10000);
    }
    
    // صوت تنبيه
    this.playNotificationSound();
  }

  // تشغيل صوت التنبيه
  playNotificationSound() {
    // إنشاء صوت باستخدام Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }

  // عرض واجهة المراجعة
  showStudyInterface() {
    const modal = this.createStudyModal();
    document.body.appendChild(modal);
    
    // ملء الشاشة
    if (modal.requestFullscreen) {
      modal.requestFullscreen().catch(err => console.log('Fullscreen failed:', err));
    }
  }

  // إخفاء واجهة المراجعة
  hideStudyInterface() {
    const modal = document.getElementById('pomodoroStudyModal');
    if (modal) {
      modal.remove();
    }
    
    // الخروج من ملء الشاشة
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    
    // إعادة تعيين عنوان الصفحة
    document.title = 'جدول المراجعة';
  }

  // إنشاء واجهة المراجعة
  createStudyModal() {
    const modal = document.createElement('div');
    modal.id = 'pomodoroStudyModal';
    modal.className = 'pomodoro-fullscreen';
    
    const phase = this.isBreakTime ? 'راحة' : 'مراجعة';
    const phaseIcon = this.isBreakTime ? '☕' : '📚';
    const phaseColor = this.isBreakTime ? '#10b981' : '#4f46e5';
    
    modal.innerHTML = `
      <div class="pomodoro-container">
        <div class="pomodoro-header">
          <h1>${phaseIcon} ${phase}</h1>
          <h2>${this.session?.taskName || 'مهمة'}</h2>
        </div>
        
        <div class="pomodoro-timer">
          <div class="timer-circle" style="--primary-color: ${phaseColor}">
            <div class="timer-display" id="pomodoroTimeDisplay">
              ${this.formatTime(this.currentTime)}
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="pomodoroProgress"></div>
          </div>
        </div>
        
        <div class="pomodoro-controls">
          <button class="btn-pomodoro pause" id="pomodoroPlayPause">
            ${this.isRunning ? '⏸️ إيقاف مؤقت' : '▶️ استئناف'}
          </button>
          <button class="btn-pomodoro end" id="pomodoroEnd">
            🏁 إنهاء الجلسة
          </button>
          <button class="btn-pomodoro postpone" id="pomodoroPostpone">
            ⏭️ تأجيل المهمة
          </button>
        </div>
        
        ${!this.isBreakTime ? `
        <div class="pomodoro-notes">
          <h3>📝 ملاحظات المراجعة</h3>
          <textarea id="pomodoroNotes" placeholder="اكتب ملاحظاتك هنا...">${this.session?.notes || ''}</textarea>
        </div>
        ` : `
        <div class="break-activities">
          <h3>💡 أنشطة الراحة المقترحة</h3>
          <div class="activity-list">
            <div class="activity">🚶‍♂️ امشِ قليلاً</div>
            <div class="activity">💧 اشرب الماء</div>
            <div class="activity">👀 أرح عينيك</div>
            <div class="activity">🧘‍♂️ تنفس بعمق</div>
          </div>
        </div>
        `}
        
        <div class="pomodoro-stats">
          <div class="stat">
            <span class="stat-label">الوقت المحدد</span>
            <span class="stat-value">${this.studyTime} دقيقة</span>
          </div>
          <div class="stat">
            <span class="stat-label">وقت الراحة</span>
            <span class="stat-value">${this.breakTime} دقيقة</span>
          </div>
        </div>
      </div>
    `;
    
    this.bindModalEvents(modal);
    return modal;
  }

  // ربط أحداث الواجهة
  bindModalEvents(modal) {
    const playPauseBtn = modal.querySelector('#pomodoroPlayPause');
    const endBtn = modal.querySelector('#pomodoroEnd');
    const postponeBtn = modal.querySelector('#pomodoroPostpone');
    const notesArea = modal.querySelector('#pomodoroNotes');
    
    playPauseBtn?.addEventListener('click', () => {
      if (this.isRunning) {
        this.pauseTimer();
      } else {
        this.resumeTimer();
      }
    });
    
    endBtn?.addEventListener('click', () => {
      if (confirm('هل أنت متأكد من إنهاء الجلسة؟')) {
        this.endSession(true);
      }
    });
    
    postponeBtn?.addEventListener('click', () => {
      if (confirm('هل تريد تأجيل هذه المهمة؟')) {
        this.endSession(false);
      }
    });
    
    notesArea?.addEventListener('input', (e) => {
      if (this.session) {
        this.session.notes = e.target.value;
        localStorage.setItem('pomodoroSession', JSON.stringify(this.session));
      }
    });
    
    // منع الخروج من ملء الشاشة عند الضغط على Escape
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
      }
    });
  }

  // تحديث زر الإيقاف/التشغيل
  updatePauseButton() {
    const btn = document.getElementById('pomodoroPlayPause');
    if (btn) {
      btn.innerHTML = this.isRunning ? '⏸️ إيقاف مؤقت' : '▶️ استئناف';
    }
  }

  // عرض واجهة الراحة
  showBreakInterface() {
    const modal = document.getElementById('pomodoroStudyModal');
    if (modal) {
      modal.remove();
    }
    this.showStudyInterface(); // إعادة إنشاء الواجهة بحالة الراحة
  }

  // عرض إكمال الجلسة
  showSessionComplete() {
    this.hideStudyInterface();
    
    const completeModal = document.createElement('div');
    completeModal.className = 'pomodoro-complete-modal';
    completeModal.innerHTML = `
      <div class="complete-content">
        <h2>🎉 تمت الجلسة بنجاح!</h2>
        <p>أكملت ${this.studyTime} دقيقة من المراجعة</p>
        <div class="complete-actions">
          <button class="btn btn-primary" id="startAnother">
            🔄 جلسة أخرى
          </button>
          <button class="btn btn-success" id="markCompleted">
            ✅ تم إنجاز المهمة
          </button>
          <button class="btn btn-secondary" id="backToSchedule">
            📅 العودة للجدول
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(completeModal);
    
    // ربط الأحداث
    completeModal.querySelector('#startAnother')?.addEventListener('click', () => {
      completeModal.remove();
      this.startSession(this.currentTask, this.studyTime);
    });
    
    completeModal.querySelector('#markCompleted')?.addEventListener('click', () => {
      completeModal.remove();
      this.markTaskCompleted();
    });
    
    completeModal.querySelector('#backToSchedule')?.addEventListener('click', () => {
      completeModal.remove();
    });
  }

  // تحديد المهمة كمكتملة
  async markTaskCompleted() {
    if (this.currentTask && window.setTaskCompleted) {
      await window.setTaskCompleted(this.currentTask.id, true);
      if (window.loadAndRender) {
        await window.loadAndRender();
      }
    }
  }

  // تنسيق الوقت
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // استرداد جلسة نشطة
  static restoreSession() {
    const sessionData = localStorage.getItem('pomodoroSession');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      const timer = new PomodoroTimer();
      timer.session = session;
      
      // حساب الوقت المتبقي
      const elapsed = (Date.now() - session.startTime) / 1000;
      const totalStudyTime = session.studyTime * 60;
      
      if (elapsed < totalStudyTime) {
        // لا يزال في فترة المراجعة
        timer.currentTask = { id: session.taskId, subjectName: session.taskName };
        timer.studyTime = session.studyTime;
        timer.currentTime = Math.max(0, totalStudyTime - elapsed);
        timer.isBreakTime = false;
        timer.isRunning = true;
        timer.showStudyInterface();
        timer.startTimer();
      } else {
        // انتهت الجلسة
        localStorage.removeItem('pomodoroSession');
      }
      
      return timer;
    }
    return null;
  }

  // الحصول على إحصائيات اليوم
  static getTodayStats() {
    const history = JSON.parse(localStorage.getItem('pomodoroHistory') || '[]');
    const today = new Date().toDateString();
    
    const todaySessions = history.filter(session => 
      new Date(session.startTime).toDateString() === today
    );
    
    const completedSessions = todaySessions.filter(s => s.completed);
    const totalStudyTime = completedSessions.reduce((sum, s) => sum + s.studyTime, 0);
    
    return {
      sessionsCount: todaySessions.length,
      completedCount: completedSessions.length,
      totalStudyTime,
      currentStreak: this.calculateStreak()
    };
  }

  // حساب streak الأيام المتتالية
  static calculateStreak() {
    const history = JSON.parse(localStorage.getItem('pomodoroHistory') || '[]');
    if (history.length === 0) return 0;
    
    const days = [...new Set(history.map(s => 
      new Date(s.startTime).toDateString()
    ))].sort().reverse();
    
    let streak = 0;
    const today = new Date().toDateString();
    
    for (let i = 0; i < days.length; i++) {
      const dayDiff = Math.floor((new Date(today) - new Date(days[i])) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === i) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }
}

// إنشاء instance عام
window.pomodoroTimer = new PomodoroTimer();

// استرداد جلسة نشطة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  PomodoroTimer.restoreSession();
});