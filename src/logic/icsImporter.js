import ical from 'ical.js';

export const parseICS = (fileData) => {
  try {
    const jcalData = ical.parse(fileData);
    const comp = new ical.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    return vevents.map(event => {
      let summary = event.getFirstPropertyValue('summary') || "Sans titre";
      // NETTOYAGE : Supprime "Indisponibilité -" s'il est présent
      summary = summary.replace(/^Indisponibilité\s*-\s*/, '');

      const location = event.getFirstPropertyValue('location') || "";
      const description = event.getFirstPropertyValue('description') || "";
      
      // EXTRACTION PROFESSEUR (si présent dans la description ou le titre)
      // Souvent les noms sont en MAJUSCULES à la fin du texte
      const teacherMatch = description.match(/[A-Z]{2,}\s+[A-Z][a-z]+/);
      const teacher = teacherMatch ? teacherMatch[0] : "";

      const dtstart = event.getFirstPropertyValue('dtstart');
      const dtend = event.getFirstPropertyValue('dtend');
      const startDate = dtstart.toJSDate();
      const endDate = dtend.toJSDate();

      return {
        id: Math.random().toString(36).substr(2, 9),
        text: summary,
        type: 'FIXED',
        done: false,
        dueDate: startDate.toISOString().split('T')[0],
        startTime: startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        endTime: endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        location: location,
        teacher: teacher, // Nouvelle propriété
        priority: 1
      };
    });
  } catch (e) {
    console.error("Erreur parsing ICS:", e);
    return [];
  }
};