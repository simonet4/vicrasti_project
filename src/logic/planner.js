export const organizeDay = (todos, selectedDate) => {
  const dayStart = 8 * 60; 
  const dayEnd = 22 * 60;   
  const step = 30; 

  const safeTodos = Array.isArray(todos) ? todos : [];
  const fixedTasks = safeTodos.filter(t => t.type === 'FIXED' && t.dueDate === selectedDate);
  
  // On récupère tous les marqueurs de projets déjà terminés aujourd'hui
  const completedSlots = safeTodos.filter(t => t.type === 'AUTO_DONE');

  const projects = safeTodos.filter(t => t.type === 'PROJECT' && !t.done);
  const now = new Date();
  
  const enhancedProjects = projects.map(p => {
    const deadline = new Date(p.deadline);
    const diffTime = deadline - now;
    const daysLeft = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const hoursRemaining = parseFloat(p.totalHours || 0);
    const urgencyScore = hoursRemaining / daysLeft;

    return { ...p, slotsToFill: (hoursRemaining * 2), urgency: urgencyScore };
  }).sort((a, b) => b.urgency - a.urgency);

  let finalSchedule = [...fixedTasks];

  for (let minutes = dayStart; minutes < dayEnd; minutes += step) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const timeStr = `${h < 10 ? '0' : ''}${h}:${m === 0 ? '00' : '30'}`;
    const nextTimeStr = `${Math.floor((minutes + 30) / 60)}:${(minutes + 30) % 60 === 0 ? '00' : '30'}`;

    const isBusyFixed = fixedTasks.some(f => timeStr < f.endTime && nextTimeStr > f.startTime);

    // CORRECTION : On cherche si un projet a été validé sur ce créneau précis
    const doneSlot = completedSlots.find(t => t.id.includes(timeStr));

    if (doneSlot) {
      // Si le créneau est fait, on l'affiche (coché) au lieu de l'ignorer
      const parentProject = safeTodos.find(p => p.id === doneSlot.parentId);
      finalSchedule.push({
        id: doneSlot.id,
        parentProjectId: doneSlot.parentId,
        text: `✅ ${parentProject ? parentProject.text : 'Projet terminé'}`,
        startTime: timeStr,
        endTime: nextTimeStr,
        type: 'AUTO',
        done: true // Reste visible et coché
      });
    } else if (!isBusyFixed) {
      // Sinon, on propose le projet suivant selon la priorité
      const bestP = enhancedProjects.find(p => p.slotsToFill > 0);
      if (bestP) {
        finalSchedule.push({
          id: `auto-${bestP.id}-${timeStr}`,
          parentProjectId: bestP.id,
          text: `💻 ${bestP.text}`,
          startTime: timeStr,
          endTime: nextTimeStr,
          type: 'AUTO',
          done: false
        });
        bestP.slotsToFill -= 1;
      }
    }
  }

  return { schedule: finalSchedule.sort((a, b) => a.startTime.localeCompare(b.startTime)), conflicts: [] };
};