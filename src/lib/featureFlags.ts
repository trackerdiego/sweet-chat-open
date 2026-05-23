// Feature flags globais. Mude aqui pra ligar/desligar features sem mexer em DB.
//
// HYPE_GLOBAL_RELEASE: quando false, NINGUÉM (nem equipe premium manual,
// nem pagantes pós-8d) dispara `start-hype-job`. Todos veem GiftCard "Em breve".
// Vire pra true quando a ferramenta de thumbs TikTok estiver assinada
// e o Hype puder ir pra todos.
export const HYPE_GLOBAL_RELEASE = false;
