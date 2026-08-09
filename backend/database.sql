-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  full_name character varying NOT NULL,
  role character varying DEFAULT 'ctv'::character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE public.participants (
  id character varying NOT NULL,
  account_type character varying NOT NULL,
  username character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  full_name character varying NOT NULL,
  class_name character varying,
  faculty_name character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT participants_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tournaments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  game_name character varying NOT NULL,
  game_logo_url text,
  banner_url text NOT NULL,
  participation_type character varying NOT NULL,
  max_participants integer NOT NULL,
  min_team_size integer,
  max_team_size integer,
  registration_open_at timestamp with time zone NOT NULL,
  registration_close_at timestamp with time zone NOT NULL,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  description text,
  use_external_link boolean DEFAULT false,
  external_registration_url text,
  form_schema jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  approved_by uuid,
  status character varying DEFAULT 'pending'::character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  approved_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tournaments_pkey PRIMARY KEY (id),
  CONSTRAINT tournaments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE TABLE public.registrations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  captain_id character varying NOT NULL,
  team_name character varying,
  submitted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status character varying DEFAULT 'pending'::character varying,
  registered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  is_auto_matched boolean DEFAULT false,
  CONSTRAINT registrations_pkey PRIMARY KEY (id),
  CONSTRAINT registrations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT registrations_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES public.participants(id)
);

CREATE TABLE public.registration_members (
  registration_id uuid NOT NULL,
  participant_id character varying NOT NULL,
  is_captain boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT registration_members_pkey PRIMARY KEY (registration_id, participant_id),
  CONSTRAINT fk_rm_registration FOREIGN KEY (registration_id) REFERENCES public.registrations(id),
  CONSTRAINT fk_rm_participant FOREIGN KEY (participant_id) REFERENCES public.participants(id)
);