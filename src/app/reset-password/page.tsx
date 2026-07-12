import ResetPasswordForm from "@/app/reset-password/ResetPasswordForm";

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;
  return <ResetPasswordForm token={token ?? ""} />;
}
