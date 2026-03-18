import React from 'react';
import { useNavigate } from '@richie-router/react';

interface DocsSearchFormProps {
  initialQuery?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

export function DocsSearchForm(props: DocsSearchFormProps) {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState(props.initialQuery ?? '');
  const inputId = React.useId();

  React.useEffect(() => {
    setQuery(props.initialQuery ?? '');
  }, [props.initialQuery]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await navigate({
      to: '/search',
      search: {
        q: query.trim(),
      },
    });
  }

  return (
    <form
      className={props.compact ? 'docs-search-form docs-search-form--compact' : 'docs-search-form'}
      onSubmit={event => {
        void onSubmit(event);
      }}
    >
      <label className={props.compact ? 'sr-only' : 'docs-search-label'} htmlFor={inputId}>
        Search the markdown docs
      </label>
      <input
        id={inputId}
        className="docs-search-input"
        type="search"
        value={query}
        placeholder="Search markdown, routes, API docs..."
        autoFocus={props.autoFocus}
        onChange={event => {
          setQuery(event.target.value);
        }}
      />
      <button className="docs-search-button" type="submit">
        Search
      </button>
    </form>
  );
}
