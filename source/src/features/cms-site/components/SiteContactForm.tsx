import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { feedbackApi, FeedbackApiError } from '../../feedback/api/feedbackApi';
import { useFeedbackPolicy } from '../../feedback/hooks/useFeedbackPolicy';
import { SessionExpiredError } from '../../../shared/api/authSession';

type SiteContactFormProps = {
  fallbackEmail?: string;
};

/**
 * Wires the public Contact page into AppEndO's real Feedback system —
 * the same ticket queue Studio operators triage from the Dashboard. Not a
 * decorative form: a submission here creates an actual `baseAppFeedback` row.
 */
export const SiteContactForm: React.FC<SiteContactFormProps> = ({ fallbackEmail }) => {
  const culture = useOptionalCulture();
  const cultureId = culture?.cultureId || 'us';
  const { currentUser } = useAuth();
  const { policy, isLoading } = useFeedbackPolicy('contact');

  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const isAnonymous = !currentUser;
  const showContactFields = isAnonymous && policy.showContactFieldsForAnonymous;
  const canSubmit = isAnonymous ? policy.allowAnonymous : policy.allowAuthenticated;
  const activeSubject = subjectId || policy.subjects[0]?.id || '';

  if (isLoading) {
    return null;
  }

  if (!policy.enabled || !canSubmit) {
    return (
      <p className="site-contact-note">
        {fallbackEmail
          ? `The feedback inbox isn't open to everyone on this install yet — write ${fallbackEmail} instead.`
          : "The feedback inbox isn't open to everyone on this install yet."}
      </p>
    );
  }

  if (ticketId) {
    return (
      <p className="site-contact-note">
        Sent — ticket #{ticketId} is in the Feedback inbox now.
        {fallbackEmail ? ` If it's urgent, write ${fallbackEmail}.` : ''}
      </p>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Add a title and a message.');
      return;
    }
    if (policy.requireSubject && !activeSubject) {
      setError('Pick a subject.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { ticket } = await feedbackApi.submit({
        subjectId: activeSubject,
        title: title.trim(),
        body: body.trim(),
        anonymousContact: showContactFields
          ? { name: name.trim() || undefined, email: email.trim() || undefined }
          : undefined,
        portalSlug: cultureId,
        pageKey: 'contact',
        route: typeof window !== 'undefined' ? window.location.pathname : null,
        metadata: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
        },
        honeypot,
      });
      setTicketId(ticket.id);
    } catch (err) {
      if (err instanceof FeedbackApiError) {
        setError(err.message || 'Could not send that. Try again.');
      } else if (err instanceof SessionExpiredError) {
        setError('Your session expired. Sign in again to send this.');
      } else {
        setError('Could not send that. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="site-contact-form" onSubmit={(event) => void handleSubmit(event)}>
      {error ? <p className="site-contact-error">{error}</p> : null}
      {policy.subjects.length > 0 ? (
        <div className="site-contact-subjects" role="radiogroup" aria-label="Subject">
          {policy.subjects.map((subject) => (
            <button
              key={subject.id}
              type="button"
              className="site-slides-tab"
              role="radio"
              aria-checked={activeSubject === subject.id}
              data-active={activeSubject === subject.id ? 'true' : 'false'}
              onClick={() => setSubjectId(subject.id)}
            >
              {subject.label}
            </button>
          ))}
        </div>
      ) : null}
      <label>
        Title
        <input name="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <label>
        Message
        <textarea name="message" value={body} onChange={(event) => setBody(event.target.value)} required />
      </label>
      {showContactFields ? (
        <>
          <label>
            Name
            <input name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        </>
      ) : null}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(event) => setHoneypot(event.target.value)}
        className="site-contact-honeypot"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <button className="site-store" type="submit" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
};
