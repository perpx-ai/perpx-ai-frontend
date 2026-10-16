import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import DebridgeWidget from "./WidgetBox";

export default function NewSwapBox() {
  return (
    <AppPageLayout>
      <div className="flex w-full items-center justify-center px-16 py-32">
        <div className="w-full max-w-[600px]">
          <DebridgeWidget />
        </div>
      </div>
    </AppPageLayout>
  );
}
