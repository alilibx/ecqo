export function PageSpinner() {
  return (
    <div className="page-pending">
      <div className="page-pending-header">
        <div className="page-pending-logo">
          <img src="/logos/logo-icon.png" alt="" className="page-pending-logo-img" />
        </div>
      </div>
      <div className="page-pending-skeleton">
        <div className="skel skel-bar skel-w60" />
        <div className="skel skel-bar skel-w40" />
        <div className="skel-row">
          <div className="skel skel-card" />
          <div className="skel skel-card" />
          <div className="skel skel-card" />
        </div>
        <div className="skel skel-bar skel-w80" />
        <div className="skel skel-bar skel-w50" />
      </div>
    </div>
  );
}
