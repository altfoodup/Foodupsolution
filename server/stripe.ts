import Stripe from 'stripe';

let client: Stripe | null = null;

// Création à la demande, pour que dotenv ait le temps de charger le .env
export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY manquante');
    client = new Stripe(key);
  }
  return client;
}

const enCentimes = (montant: number) => Math.round(montant * 100);

/* ---------- Paiement de la commande ---------- */

// Autorise la carte sans encaisser (capture manuelle)
export async function creerAutorisationCommande(params: {
  commandeId: string;
  montantTotal: number;
  emailClient?: string;
}) {
  const pi = await getStripe().paymentIntents.create(
    {
      amount: enCentimes(params.montantTotal),
      currency: 'eur',
      capture_method: 'manual',
      automatic_payment_methods: { enabled: true },
      transfer_group: params.commandeId,
      receipt_email: params.emailClient,
      metadata: { commande_id: params.commandeId },
    },
    { idempotencyKey: `pi_commande_${params.commandeId}` },
  );
  return { paymentIntentId: pi.id, clientSecret: pi.client_secret };
}

// Encaisse quand le restaurateur accepte la commande
export async function capturerPaiement(paymentIntentId: string) {
  const pi = await getStripe().paymentIntents.capture(paymentIntentId);
  const chargeId =
    typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null;
  return { chargeId };
}

// Refus ou annulation: libère l'autorisation, ou rembourse si déjà encaissé
export async function annulerOuRembourser(paymentIntentId: string) {
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status === 'canceled') return { action: 'deja_annule' as const };
  if (pi.status === 'succeeded') {
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
    return { action: 'rembourse' as const, refundId: refund.id };
  }
  await stripe.paymentIntents.cancel(paymentIntentId);
  return { action: 'annule' as const };
}

/* ---------- Virements aux partenaires (à la livraison) ---------- */

export async function verserAuxPartenaires(params: {
  commandeId: string;
  chargeId: string;
  restaurateur: { accountId: string; montant: number };
  livreur?: { accountId: string; montant: number };
}) {
  const stripe = getStripe();
  const commun = {
    currency: 'eur',
    transfer_group: params.commandeId,
    source_transaction: params.chargeId,
  };

  const resto = await stripe.transfers.create(
    {
      ...commun,
      amount: enCentimes(params.restaurateur.montant),
      destination: params.restaurateur.accountId,
      metadata: { commande_id: params.commandeId, role: 'restaurateur' },
    },
    { idempotencyKey: `tr_resto_${params.commandeId}` },
  );

  let livreurTransferId: string | null = null;
  if (params.livreur) {
    const liv = await stripe.transfers.create(
      {
        ...commun,
        amount: enCentimes(params.livreur.montant),
        destination: params.livreur.accountId,
        metadata: { commande_id: params.commandeId, role: 'livreur' },
      },
      { idempotencyKey: `tr_livreur_${params.commandeId}` },
    );
    livreurTransferId = liv.id;
  }

  return { transferRestaurateurId: resto.id, transferLivreurId: livreurTransferId };
}

// Après un remboursement d'une commande déjà livrée
export async function annulerVirement(transferId: string, montant?: number) {
  return getStripe().transfers.createReversal(transferId, {
    amount: montant !== undefined ? enCentimes(montant) : undefined,
  });
}

/* ---------- Comptes connectés (restaurateurs / livreurs) ---------- */

export async function creerCompteConnecte(params: { email: string; nom: string }) {
  const compte = await getStripe().v2.core.accounts.create({
    display_name: params.nom,
    contact_email: params.email,
    identity: { country: 'fr' },
    dashboard: 'express',
    defaults: {
      responsibilities: {
        fees_collector: 'application',
        losses_collector: 'application',
      },
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: { stripe_transfers: { requested: true } },
        },
      },
    },
  });
  return compte.id;
}

// Le front s'en sert pour afficher le formulaire d'inscription Stripe intégré
export async function creerSessionOnboarding(accountId: string) {
  const session = await getStripe().accountSessions.create({
    account: accountId,
    components: { account_onboarding: { enabled: true } },
  });
  return session.client_secret;
}

// À vérifier avant tout virement
export async function compteEstPret(accountId: string) {
  const compte = await getStripe().v2.core.accounts.retrieve(accountId, {
    include: ['configuration.recipient'],
  });
  return (
    compte.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ===
    'active'
  );
}

/* ---------- Webhook ---------- */

export function construireEvenementWebhook(corpsBrut: Buffer, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET manquant');
  return getStripe().webhooks.constructEvent(corpsBrut, signature, secret);
}
// Statut réel du paiement chez Stripe (filet de sécurité si le webhook tarde)
export async function statutPaiement(paymentIntentId: string) {
  const pi = await getStripe().paymentIntents.retrieve(paymentIntentId);
  return pi.status;
}
