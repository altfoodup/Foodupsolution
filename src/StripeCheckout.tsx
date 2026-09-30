import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const clePublique = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = clePublique ? loadStripe(clePublique) : null;

type Props = {
  clientSecret: string;
  montant: number;
  onSucces: () => void;
  onAnnuler: () => void;
};

function FormulairePaiement({ montant, onSucces, onAnnuler }: Omit<Props, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const payer = async () => {
    if (!stripe || !elements) return;
    setEnCours(true);
    setErreur(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });
    const { error, paymentIntent } = await stripe.confirmPayment({
  elements,
  redirect: 'if_required',
  confirmParams: { return_url: window.location.href },
});

if (error) {
  // ton code actuel pour afficher l'erreur
  return;
}

    if (error) {
      setErreur(error.message ?? 'Le paiement a échoué.');
      setEnCours(false);
      return;
    }

    // Capture manuelle : la carte est autorisée ("requires_capture"), le débit a lieu à l'acceptation
    if (paymentIntent && ['requires_capture', 'succeeded', 'processing'].includes(paymentIntent.status)) {
      onSucces();
    } else {
      setErreur('Le paiement n’a pas pu être confirmé. Veuillez réessayer.');
      setEnCours(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <PaymentElement />
      {erreur && <p style={{ color: '#b91c1c', marginTop: 12 }}>{erreur}</p>}
      <button
        onClick={payer}
        disabled={!stripe || enCours}
        style={{
          width: '100%', marginTop: 16, padding: '16px 0', borderRadius: 999, border: 'none',
          background: '#f56a00', color: '#fff', fontWeight: 800, fontSize: 18,
          opacity: !stripe || enCours ? 0.6 : 1, cursor: 'pointer',
        }}
      >
        {enCours ? 'Paiement en cours…' : `Payer — ${montant.toFixed(2).replace('.', ',')} €`}
      </button>
      <button
        onClick={onAnnuler}
        disabled={enCours}
        style={{ width: '100%', marginTop: 8, padding: 10, background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}
      >
        Annuler
      </button>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 8 }}>
        Votre carte est autorisée maintenant, puis débitée quand le restaurant accepte la commande.
      </p>
    </div>
  );
}

export default function StripeCheckout({ clientSecret, montant, onSucces, onAnnuler }: Props) {
  if (!stripePromise) {
    return <p style={{ padding: 16, color: '#b91c1c' }}>Clé publique Stripe manquante (VITE_STRIPE_PUBLISHABLE_KEY).</p>;
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, locale: 'fr' }}>
      <FormulairePaiement montant={montant} onSucces={onSucces} onAnnuler={onAnnuler} />
    </Elements>
  );
}
