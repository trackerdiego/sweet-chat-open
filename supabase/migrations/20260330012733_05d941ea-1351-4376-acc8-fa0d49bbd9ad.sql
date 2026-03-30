
-- user_profiles
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own profile" ON public.user_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_strategies
CREATE POLICY "Users can insert own strategies" ON public.user_strategies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own strategies" ON public.user_strategies FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own strategies" ON public.user_strategies FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_progress
CREATE POLICY "Users can insert own progress" ON public.user_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own progress" ON public.user_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.user_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_usage
CREATE POLICY "Users can insert own usage" ON public.user_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own usage" ON public.user_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON public.user_usage FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- audience_profiles
CREATE POLICY "Users can insert own audience profile" ON public.audience_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own audience profile" ON public.audience_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own audience profile" ON public.audience_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- push_subscriptions
CREATE POLICY "Users can insert own subscriptions" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON public.push_subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own subscriptions" ON public.push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role full access push" ON public.push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- usage_logs
CREATE POLICY "Users can insert own logs" ON public.usage_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access logs" ON public.usage_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- email_send_log
CREATE POLICY "Service role can insert send log" ON public.email_send_log FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read send log" ON public.email_send_log FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role can update send log" ON public.email_send_log FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- email_send_state
CREATE POLICY "Service role can manage send state" ON public.email_send_state FOR ALL TO service_role USING (true) WITH CHECK (true);

-- suppressed_emails
CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails FOR SELECT TO service_role USING (true);

-- email_unsubscribe_tokens
CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens FOR UPDATE TO service_role USING (true) WITH CHECK (true);
