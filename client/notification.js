//mit hilfe copilot... beim speichern wird nachricht angezeigt anstatt popup...
class NotificationManager {
    static notifications = [];

    static add(message, type = "info") {
        const id = Date.now();
        this.notifications.push({ id, message, type });

        this.render(); // Benachrichtigungen aktualisieren

        // Benachrichtigung nach 3 Sekunden entfernen
        setTimeout(() => {
            this.notifications = this.notifications.filter((n) => n.id !== id);
            this.render();
        }, 3000);
    }

    static render() {
        // Container für Benachrichtigungen erstellen, falls nicht vorhanden
        let container = document.getElementById("notification-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "notification-container";
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        // Benachrichtigungen rendern
        container.innerHTML = this.notifications
            .map(
                (n) => `
            <div style="
                padding: 10px 20px;
                border-radius: 5px;
                color: white;
                font-size: 14px;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
                background-color: ${n.type === "success" ? "#4caf50" : n.type === "error" ? "#f44336" : "#2196f3"};
                animation: fade-in-out 3s ease-in-out forwards;
            ">
                ${n.message}
            </div>
        `
            )
            .join("");
    }
}

export const notifyAlert = (message, type = "info") => {
    NotificationManager.add(message, type);
};
