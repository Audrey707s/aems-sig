import { MasterDataNav } from "@/components/master-data/MasterDataNav";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <MasterDataNav />
      {children}
    </div>
  );
}
