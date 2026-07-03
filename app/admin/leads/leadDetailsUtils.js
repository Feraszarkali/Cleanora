export function getLeadSummaryFields(lead, quoteCount) {
  const createdDate = lead?.created_at ? new Date(lead.created_at) : null
  const createdLabel = createdDate && !Number.isNaN(createdDate.getTime())
    ? createdDate.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Not available'

  return [
    {
      label: 'Current Status',
      value: lead?.status || 'Unknown',
      tone: 'default',
    },
    {
      label: 'Location',
      value: lead?.city || 'Not provided',
      tone: 'default',
    },
    {
      label: 'Services',
      value: Array.isArray(lead?.services)
        ? lead.services.join(', ')
        : lead?.services || 'Not provided',
      tone: 'default',
    },
    {
      label: 'Quotes',
      value: quoteCount > 0 ? `${quoteCount} request${quoteCount === 1 ? '' : 's'}` : 'No quote requests yet',
      tone: quoteCount > 0 ? 'accent' : 'muted',
    },
    {
      label: 'Created',
      value: createdLabel,
      tone: 'muted',
    },
  ]
}